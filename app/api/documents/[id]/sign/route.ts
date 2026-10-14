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
 * Only available when document status is APPROVED, CONTROLLED, or EXCO_PENDING.
 *
 * Form fields:
 *   file        — the signed page file
 *   autoControl — if 'true' and document is APPROVED, also transitions to CONTROLLED
 *                 in the same transaction (W5: sign + publish in one step).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true, status: true, uploadedById: true, title: true,
        documentTypeCode: true, documentNumber: true,
      },
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

    // autoControl: sign + mark as CONTROLLED in one atomic step
    const autoControl = formData.get('autoControl') === 'true' && document.status === 'APPROVED'

    // ── Upload file ──────────────────────────────────────────────────────────
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
          return NextResponse.json(
            { error: 'File upload failed — SharePoint and local storage both unavailable' },
            { status: 500 },
          )
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

    // ── Calculate CONTROLLED dates (only when autoControl) ───────────────────
    const reviewYears: Record<string, number> = { ST: 1, RM: 2, TOR: 2, GL: 3, BC: 3 }
    const now = new Date()
    const controlledAt = autoControl ? now.toISOString() : undefined
    const retentionDate = autoControl
      ? (() => { const d = new Date(now); d.setFullYear(d.getFullYear() + 40); return d.toISOString() })()
      : undefined
    const nextReviewDate = autoControl
      ? (() => {
          const years = document.documentTypeCode ? (reviewYears[document.documentTypeCode] ?? 6) : 6
          const d = new Date(now)
          d.setFullYear(d.getFullYear() + years)
          return d.toISOString().split('T')[0]
        })()
      : undefined

    // W3: find previous controlled revision to supersede atomically
    const previousControlled = autoControl && document.documentNumber
      ? await prisma.document.findFirst({
          where: { documentNumber: document.documentNumber, status: 'CONTROLLED', id: { not: id } },
          select: { id: true },
        })
      : null

    // ── Atomic transaction: sign (+ optional control + W3 supersede) ─────────
    await prisma.$transaction([
      prisma.document.update({
        where: { id },
        data: {
          signedPageUrl,
          signedPageName,
          ...(autoControl && {
            status: 'CONTROLLED',
            controlledAt,
            retentionDate,
            nextReviewDate,
          }),
        },
      }),
      prisma.documentActivity.create({
        data: {
          documentId: id,
          userId: session.userId,
          action: 'SIGNED_PAGE_UPLOADED',
          details: `Signed page: ${signedPageName}`,
        },
      }),
      ...(autoControl ? [
        prisma.documentActivity.create({
          data: { documentId: id, userId: session.userId, action: 'CONTROLLED', details: null },
        }),
      ] : []),
      ...(previousControlled ? [
        prisma.document.update({
          where: { id: previousControlled.id },
          data: { status: 'SUPERSEDED' },
        }),
        prisma.documentActivity.create({
          data: {
            documentId: previousControlled.id,
            userId: session.userId,
            action: 'SUPERSEDED',
            details: `Automatically superseded when document ${document.documentNumber} was re-controlled`,
          },
        }),
      ] : []),
    ])

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

    const updated = await prisma.document.findUnique({ where: { id }, include: docInclude })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[sign] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error', detail: String(err) }, { status: 500 })
  }
}
