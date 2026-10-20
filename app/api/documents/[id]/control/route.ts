import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createNotification } from '@/lib/notify'
import { sendStatusChangeEmail } from '@/lib/email'
import { emitDocStatusChange } from '@/lib/realtime'

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

  if (!['CONTROLLED', 'SUPERSEDED', 'CANCELLED', 'CHANGES_REQUESTED'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true, title: true, status: true, uploadedById: true, documentTypeCode: true, isExcoRequired: true,
      documentNumber: true,
      uploadedBy: { select: { id: true, name: true, email: true } },
      originatorUser: { select: { id: true, name: true, email: true } },
    },
  })

  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const canAct = session.role === 'ADMIN' || document.uploadedById === session.userId
  if (!canAct) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Validate allowed transitions
  const allowedFrom: Record<string, string[]> = {
    CONTROLLED: ['APPROVED', 'EXCO_PENDING'],
    SUPERSEDED: ['CONTROLLED'],
    CANCELLED: ['DRAFT', 'PENDING_REVIEW', 'IN_REVIEW', 'REVIEW_COMPLETE', 'PENDING_APPROVAL', 'APPROVED', 'CONTROLLED', 'EXCO_PENDING', 'CHANGES_REQUESTED', 'REJECTED'],
    // W9 (route b): Document Controller can send a Controlled document back for corrections
    CHANGES_REQUESTED: ['CONTROLLED'],
  }

  if (!allowedFrom[action]?.includes(document.status)) {
    return NextResponse.json(
      { error: `Cannot mark as ${action} from status ${document.status}` },
      { status: 400 },
    )
  }

  const activityActionMap: Record<string, 'CONTROLLED' | 'SUPERSEDED' | 'CANCELLED' | 'STATUS_CHANGED'> = {
    CONTROLLED: 'CONTROLLED',
    SUPERSEDED: 'SUPERSEDED',
    CANCELLED: 'CANCELLED',
    CHANGES_REQUESTED: 'STATUS_CHANGED',
  }

  // On CONTROLLED: set controlledAt + 40-year retention + recalculate nextReviewDate from publication date
  const reviewYears: Record<string, number> = { ST: 1, RM: 2, TOR: 2, GL: 3, BC: 3 }
  const now = new Date()
  const controlledAt = action === 'CONTROLLED' ? now.toISOString() : undefined
  const retentionDate = action === 'CONTROLLED'
    ? (() => { const d = new Date(now); d.setFullYear(d.getFullYear() + 40); return d.toISOString() })()
    : undefined
  const nextReviewDate = action === 'CONTROLLED'
    ? (() => {
        const yearsUntilReview = document.documentTypeCode ? (reviewYears[document.documentTypeCode] ?? 6) : 6
        const d = new Date(now)
        d.setFullYear(d.getFullYear() + yearsUntilReview)
        return d.toISOString().split('T')[0]
      })()
    : undefined

  // W3: when marking CONTROLLED, find the currently-controlled revision of the same
  // document number and supersede it atomically in the same transaction.
  const previousControlled = action === 'CONTROLLED' && document.documentNumber
    ? await prisma.document.findFirst({
        where: { documentNumber: document.documentNumber, status: 'CONTROLLED', id: { not: id } },
        select: { id: true, documentNumber: true },
      })
    : null

  await prisma.$transaction([
    prisma.document.update({
      where: { id },
      data: {
        status: action as 'CONTROLLED' | 'SUPERSEDED' | 'CANCELLED',
        ...(controlledAt && { controlledAt }),
        ...(retentionDate && { retentionDate }),
        ...(nextReviewDate && { nextReviewDate }),
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
    // W3: supersede the previous controlled revision (if any)
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
          details: `Automatically superseded when document ${document.documentNumber} was re-controlled (new revision: ${id})`,
        },
      }),
    ] : []),
  ])

  // In-app notify the uploader if the action was by someone else
  if (document.uploadedById !== session.userId) {
    const labels: Record<string, string> = {
      CONTROLLED: 'marked as Controlled',
      SUPERSEDED: 'marked as Superseded',
      CANCELLED: 'cancelled',
      CHANGES_REQUESTED: 'returned for changes',
    }
    createNotification(
      document.uploadedById,
      'STATUS_CHANGE',
      `Document ${labels[action] ?? action}: ${document.title}`,
      `"${document.title}" has been ${labels[action] ?? action}.`,
      id,
    )
    // Also notify originator if different from uploader
    if (document.originatorUser && document.originatorUser.id !== document.uploadedById) {
      createNotification(
        document.originatorUser.id,
        'STATUS_CHANGE',
        `Document ${labels[action] ?? action}: ${document.title}`,
        `"${document.title}" has been ${labels[action] ?? action}.`,
        id,
      )
    }
  }

  // Email uploader + originator for terminal status changes
  const EMAIL_CONTROL_STATUSES = new Set(['CONTROLLED', 'SUPERSEDED', 'CANCELLED'])
  if (EMAIL_CONTROL_STATUSES.has(action)) {
    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    const documentUrl = `${appUrl}/documents/${id}`
    const controlRecipients = new Map<string, { name: string; email: string }>()
    controlRecipients.set(document.uploadedBy.id, { name: document.uploadedBy.name, email: document.uploadedBy.email })
    if (document.originatorUser && document.originatorUser.id !== document.uploadedBy.id) {
      controlRecipients.set(document.originatorUser.id, { name: document.originatorUser.name, email: document.originatorUser.email })
    }
    controlRecipients.delete(session.userId)
    for (const r of controlRecipients.values()) {
      sendStatusChangeEmail({
        toEmail: r.email,
        toName: r.name,
        documentTitle: document.title,
        documentUrl,
        newStatus: action,
      }).catch((e) => console.error('[control] email error:', e))
    }
  }

  emitDocStatusChange(id, document.title, action)

  const updated = await prisma.document.findUnique({ where: { id }, include: docInclude })
  return NextResponse.json(updated)
}
