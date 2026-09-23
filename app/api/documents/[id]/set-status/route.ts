/**
 * DLT-10: Manual status change by Document Controller.
 * POST /api/documents/[id]/set-status
 * Body: { status: DocumentStatus, reason?: string }
 *
 * Restricted to DOCUMENT_MANAGER and ADMIN.
 * Fires same downstream notifications as automatic transitions.
 * Every change is audit-logged with old status, new status, user, timestamp.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createNotification } from '@/lib/notify'
import { sendStatusChangeEmail } from '@/lib/email'

const VALID_STATUSES = [
  'REGISTERED', 'DRAFT', 'PENDING_REVIEW', 'IN_REVIEW', 'UPDATING',
  'REVIEW_COMPLETE', 'FINAL_DRAFT', 'PENDING_APPROVAL', 'APPROVED',
  'EXCO_PENDING', 'CONTROLLED', 'SUPERSEDED', 'CANCELLED',
  'REJECTED', 'CHANGES_REQUESTED',
]

const docInclude = {
  uploadedBy: { select: { id: true, name: true, email: true, role: true } },
  originatorUser: { select: { id: true, name: true, email: true, role: true } },
  authorizerUser: { select: { id: true, name: true, email: true, role: true } },
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // DLT-10: Document Controller or Admin only
  if (session.role !== 'DOCUMENT_MANAGER' && session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Document Controller only' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { status: newStatus, reason } = body as { status: string; reason?: string }

  if (!VALID_STATUSES.includes(newStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true, title: true, status: true, documentNumber: true,
      uploadedById: true, originatorId: true,
      uploadedBy: { select: { id: true, name: true, email: true } },
      originatorUser: { select: { id: true, name: true, email: true } },
    },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const oldStatus = doc.status
  if (oldStatus === newStatus) {
    return NextResponse.json({ error: 'Document is already in that status' }, { status: 400 })
  }

  // Set controlledAt/retentionDate when manually moving to CONTROLLED
  const now = new Date()
  const extraData: Record<string, unknown> = {}
  if (newStatus === 'CONTROLLED') {
    extraData.controlledAt = now.toISOString()
    const retention = new Date(now)
    retention.setFullYear(retention.getFullYear() + 40)
    extraData.retentionDate = retention.toISOString()
  }

  // W3: when manually setting CONTROLLED, supersede the existing controlled revision
  // of the same document number (if any) in the same transaction.
  const previousControlled = newStatus === 'CONTROLLED' && doc.documentNumber
    ? await prisma.document.findFirst({
        where: { documentNumber: doc.documentNumber, status: 'CONTROLLED', id: { not: id } },
        select: { id: true },
      })
    : null

  await prisma.$transaction([
    prisma.document.update({
      where: { id },
      data: { status: newStatus as never, ...extraData },
    }),
    prisma.documentActivity.create({
      data: {
        documentId: id,
        userId: session.userId,
        action: 'STATUS_CHANGED',
        details: `Manual status change: ${oldStatus} → ${newStatus}${reason ? `. Reason: ${reason}` : ''}`,
      },
    }),
    // W3: supersede the previous controlled revision atomically
    ...(previousControlled ? [
      prisma.document.update({
        where: { id: previousControlled.id },
        data: { status: 'SUPERSEDED' },
      }),
      prisma.documentActivity.create({
        data: {
          documentId: previousControlled.id,
          userId: session.userId,
          action: 'STATUS_CHANGED',
          details: `Automatically superseded when document ${doc.documentNumber} was re-controlled (new revision: ${id})`,
        },
      }),
    ] : []),
  ])

  // Notify originator for ALL DC-initiated status changes
  const notifyId = doc.originatorId || doc.uploadedById
  if (notifyId !== session.userId) {
    createNotification(
      notifyId,
      'STATUS_CHANGE',
      `Document status updated: ${doc.title}`,
      `"${doc.title}" has been moved from ${oldStatus.replace(/_/g, ' ')} to ${newStatus.replace(/_/g, ' ')} by the Document Controller${reason ? `. Reason: ${reason}` : '.'}`,
      id,
    )
  }
  // Also notify the uploader (DC themselves may not be the originator — notify both if different)
  if (doc.uploadedById !== notifyId && doc.uploadedById !== session.userId) {
    createNotification(
      doc.uploadedById,
      'STATUS_CHANGE',
      `Document status updated: ${doc.title}`,
      `"${doc.title}" status changed from ${oldStatus.replace(/_/g, ' ')} to ${newStatus.replace(/_/g, ' ')}${reason ? `. Reason: ${reason}` : '.'}`,
      id,
    )
  }

  // Email originator and uploader for key status transitions
  const EMAIL_STATUSES = new Set(['CONTROLLED', 'SUPERSEDED', 'CANCELLED', 'APPROVED', 'REJECTED'])
  if (EMAIL_STATUSES.has(newStatus)) {
    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    const documentUrl = `${appUrl}/documents/${id}`
    const recipients = new Map<string, { name: string; email: string }>()
    // Uploader
    recipients.set(doc.uploadedById, { name: doc.uploadedBy.name, email: doc.uploadedBy.email })
    // Originator (if different)
    if (doc.originatorUser && doc.originatorUser.id !== doc.uploadedById) {
      recipients.set(doc.originatorUser.id, { name: doc.originatorUser.name, email: doc.originatorUser.email })
    }
    // Don't email the DC themselves
    recipients.delete(session.userId)
    for (const recipient of recipients.values()) {
      sendStatusChangeEmail({
        toEmail: recipient.email,
        toName: recipient.name,
        documentTitle: doc.title,
        documentUrl,
        newStatus,
        reason: reason ?? null,
      }).catch((err) => console.error('[set-status] email error:', err))
    }
  }

  const updated = await prisma.document.findUnique({ where: { id }, include: docInclude })
  return NextResponse.json(updated)
}
