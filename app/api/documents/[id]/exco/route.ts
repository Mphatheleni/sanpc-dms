import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { saveFile } from '@/lib/file'
import { uploadToSharePoint, isSharePointConfigured } from '@/lib/sharepoint'
import { randomUUID } from 'crypto'
import path from 'path'

const docInclude = {
  uploadedBy: { select: { id: true, name: true, email: true, role: true } },
  metadata: true,
  reviews: {
    include: { reviewer: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { order: 'asc' as const },
  },
  comments: {
    include: { author: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
}

/**
 * POST /api/documents/[id]/exco
 *
 * Two modes:
 *
 * 1) action=SUBMIT_EXCO (form: no file)
 *    APPROVED → EXCO_PENDING
 *    Used for Policy (PO) documents requiring Board/EXCO resolution.
 *
 * 2) action=UPLOAD_RESOLUTION (form: file + optional resolution number/date)
 *    EXCO_PENDING → CONTROLLED
 *    Upload the Board/EXCO resolution document, then mark as Controlled.
 *    Calculates retentionDate (controlledAt + 40 years) per CSS/PR/CSF/005.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const document = await prisma.document.findUnique({
    where: { id },
    select: { id: true, status: true, uploadedById: true, title: true, controlledAt: true },
  })
  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const canAct = session.role === 'ADMIN' || document.uploadedById === session.userId
  if (!canAct) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const contentType = req.headers.get('content-type') ?? ''
  const isMultipart = contentType.includes('multipart/form-data')

  // ── Mode 1: Submit for EXCO ────────────────────────────────────────────────
  if (!isMultipart) {
    const body = await req.json().catch(() => ({}))
    const action = body?.action

    if (action !== 'SUBMIT_EXCO') {
      return NextResponse.json({ error: 'Invalid action. Send action=SUBMIT_EXCO or multipart with file.' }, { status: 400 })
    }

    if (document.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Document must be APPROVED to submit for EXCO' }, { status: 400 })
    }

    const updated = await prisma.document.update({
      where: { id },
      data: { status: 'EXCO_PENDING' },
      include: docInclude,
    })

    prisma.documentActivity.create({
      data: {
        documentId: id,
        userId: session.userId,
        action: 'EXCO_SUBMITTED',
        details: 'Submitted for Board/EXCO approval',
      },
    }).catch(() => {})

    return NextResponse.json(updated)
  }

  // ── Mode 2: Upload Board/EXCO resolution + mark CONTROLLED ────────────────
  if (document.status !== 'EXCO_PENDING') {
    return NextResponse.json({ error: 'Document must be EXCO_PENDING to upload resolution' }, { status: 400 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = path.extname(file.name)
  const uniqueName = `exco-${randomUUID()}${ext}`

  let excoUrl = uniqueName
  const excoName = file.name

  if (isSharePointConfigured()) {
    try {
      const result = await uploadToSharePoint(uniqueName, buffer, file.type || 'application/octet-stream')
      excoUrl = result.itemId
    } catch (err) {
      console.error('[exco] SharePoint upload failed, falling back to local:', err)
      await saveFile(uniqueName, buffer)
    }
  } else {
    await saveFile(uniqueName, buffer)
  }

  // Controlled date and 40-year retention per CSS/PR/CSF/005 Section 19
  const now = new Date()
  const controlledAt = now.toISOString()
  const retentionDate = new Date(now)
  retentionDate.setFullYear(retentionDate.getFullYear() + 40)

  const updated = await prisma.document.update({
    where: { id },
    data: {
      status: 'CONTROLLED',
      excoResolutionUrl: excoUrl,
      excoResolutionName: excoName,
      controlledAt,
      retentionDate: retentionDate.toISOString(),
    },
    include: docInclude,
  })

  prisma.documentActivity.create({
    data: {
      documentId: id,
      userId: session.userId,
      action: 'CONTROLLED',
      details: `Board/EXCO resolution uploaded: ${excoName}`,
    },
  }).catch(() => {})

  return NextResponse.json(updated)
}
