import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createNotification } from '@/lib/notify'

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
 * POST /api/documents/[id]/control
 * Transition document to CONTROLLED, SUPERSEDED, or CANCELLED status.
 * Admin or Document Manager (owner) only.
 *
 * Body: { action: 'CONTROLLED' | 'SUPERSEDED' | 'CANCELLED', comments?: string }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { action, comments } = body as { action: string; comments?: string }

  if (!['CONTROLLED', 'SUPERSEDED', 'CANCELLED'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true, title: true, status: true, uploadedById: true, documentTypeCode: true, isExcoRequired: true,
      uploadedBy: { select: { id: true, name: true } },
    },
  })

  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const canAct = session.role === 'ADMIN' || document.uploadedById === session.userId
  if (!canAct) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // For Policy (PO) documents that require EXCO, APPROVED → EXCO_PENDING, not CONTROLLED directly
  if (
    action === 'CONTROLLED' &&
    document.status === 'APPROVED' &&
    (document.documentTypeCode === 'PO' || document.isExcoRequired)
  ) {
    return NextResponse.json(
      { error: 'Policy documents require Board/EXCO resolution. Use the EXCO workflow to mark as Controlled.' },
      { status: 400 },
    )
  }

  // Validate allowed transitions
  const allowedFrom: Record<string, string[]> = {
    CONTROLLED: ['APPROVED', 'EXCO_PENDING'],
    SUPERSEDED: ['CONTROLLED'],
    CANCELLED: ['DRAFT', 'PENDING_REVIEW', 'IN_REVIEW', 'REVIEW_COMPLETE', 'PENDING_APPROVAL', 'APPROVED', 'CONTROLLED', 'EXCO_PENDING', 'CHANGES_REQUESTED', 'REJECTED'],
  }

  if (!allowedFrom[action]?.includes(document.status)) {
    return NextResponse.json(
      { error: `Cannot mark as ${action} from status ${document.status}` },
      { status: 400 },
    )
  }

  const activityActionMap: Record<string, 'CONTROLLED' | 'SUPERSEDED' | 'CANCELLED'> = {
    CONTROLLED: 'CONTROLLED',
    SUPERSEDED: 'SUPERSEDED',
    CANCELLED: 'CANCELLED',
  }

  // On CONTROLLED: set controlledAt + 40-year retention
  const now = new Date()
  const controlledAt = action === 'CONTROLLED' ? now.toISOString() : undefined
  const retentionDate = action === 'CONTROLLED'
    ? (() => { const d = new Date(now); d.setFullYear(d.getFullYear() + 40); return d.toISOString() })()
    : undefined

  await prisma.$transaction([
    prisma.document.update({
      where: { id },
      data: {
        status: action as 'CONTROLLED' | 'SUPERSEDED' | 'CANCELLED',
        ...(controlledAt && { controlledAt }),
        ...(retentionDate && { retentionDate }),
      },
    }),
    prisma.documentActivity.create({
      data: {
        documentId: id,
        userId: session.userId,
        action: activityActionMap[action],
        details: comments ?? null,
      },
    }),
  ])

  // Notify the uploader if the action was by someone else
  if (document.uploadedById !== session.userId) {
    const labels: Record<string, string> = {
      CONTROLLED: 'marked as Controlled',
      SUPERSEDED: 'marked as Superseded',
      CANCELLED: 'cancelled',
    }
    createNotification(
      document.uploadedById,
      'STATUS_CHANGE',
      `Document ${labels[action]}: ${document.title}`,
      `"${document.title}" has been ${labels[action]}.`,
      id,
    )
  }

  const updated = await prisma.document.findUnique({ where: { id }, include: docInclude })
  return NextResponse.json(updated)
}
