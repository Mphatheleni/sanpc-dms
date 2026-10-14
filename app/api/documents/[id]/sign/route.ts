import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { saveFile } from '@/lib/file'
import { uploadToSharePoint, isSharePointConfigured } from '@/lib/sharepoint'
import { randomUUID } from 'crypto'
import path from 'path'

/**
 * POST /api/documents/[id]/sign
 * Upload the physical signed authorisation page (PDF/image).
 * Only available when document status is APPROVED or CONTROLLED.
 * Stores file URL and records SIGNED_PAGE_UPLOADED activity.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, status: true, uploadedById: true, title: true },
    })
    if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const canAct =
      session.role === 'ADMIN' ||
      session.role === 'DOCUMENT_MANAGER' ||
      document.uploadedById === session.userId
    if (!canAct) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (!['APPROVED', 'CONTROLLED', 'EXCO_PENDING'].includes(document.status)) {
      return NextResponse.json(
        { error: 'Signed page can only be uploaded when document is Approved or Controlled' },
        { status: 400 },
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = path.extname(file.name)
    const uniqueName = `signed-${randomUUID()}${ext}`

    let signedPageUrl = uniqueName
    const signedPageName = file.name

    if (isSharePointConfigured()) {
      try {
        const result = await uploadToSharePoint(uniqueName, buffer, file.type || 'application/octet-stream')
        signedPageUrl = result.itemId
      } catch (err) {
        console.error('[sign] SharePoint upload failed, falling back to local:', err)
        try {
          await saveFile(uniqueName, buffer)
        } catch (localErr) {
          console.error('[sign] Local fallback also failed:', localErr)
          return NextResponse.json({ error: 'File upload failed — SharePoint and local storage both unavailable' }, { status: 500 })
        }
      }
    } else {
      try {
        await saveFile(uniqueName, buffer)
      } catch (localErr) {
        console.error('[sign] Local save failed:', localErr)
        return NextResponse.json({ error: 'File upload failed — local storage unavailable' }, { status: 500 })
      }
    }

    const updated = await prisma.document.update({
      where: { id },
      data: { signedPageUrl, signedPageName },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true, role: true } },
        metadata: true,
        reviews: {
          include: { reviewer: { select: { id: true, name: true, email: true, role: true } } },
          orderBy: { order: 'asc' },
        },
        comments: {
          include: { author: { select: { id: true, name: true, email: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    prisma.documentActivity.create({
      data: {
        documentId: id,
        userId: session.userId,
        action: 'SIGNED_PAGE_UPLOADED',
        details: `Signed page: ${signedPageName}`,
      },
    }).catch(() => {})

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[sign] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error', detail: String(err) }, { status: 500 })
  }
}
