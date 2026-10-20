import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendOriginatorNotification, sendDocControllerNotification, sendBulkReviewNotificationsAsync } from '@/lib/email'
import { createNotification } from '@/lib/notify'
import { calcDeadline } from '@/lib/sla'
import { emitDocStatusChange, emitReviewAssigned } from '@/lib/realtime'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { decision, comments: rawComments } = await request.json()
  // W1: comment is optional — default to 'No comment' when empty/whitespace
  const comments = rawComments?.trim() ? rawComments.trim() : 'No comment'

  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      reviews: {
        include: { reviewer: { select: { id: true, name: true, email: true } } },
        orderBy: { order: 'asc' },
      },
      uploadedBy: { select: { id: true, name: true, email: true } },
      originatorUser: { select: { id: true, name: true, email: true } },
    },
  })

  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (document.status !== 'PENDING_APPROVAL' && document.status !== 'FINAL_DRAFT') {
    return NextResponse.json({ error: 'Document is not pending approval' }, { status: 400 })
  }

  // Find this user's active approver review — any assigned user can approve regardless of role
  const myReview = document.reviews.find(
    (r) => r.isApprover && r.reviewerId === session.userId && r.status === 'IN_PROGRESS'
  )

  if (!myReview && session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No active approval assigned to you' }, { status: 403 })
  }

  // For ADMIN with no active review, find any in-progress approver review
  const activeReview = myReview ?? document.reviews.find((r) => r.isApprover && r.status === 'IN_PROGRESS')
  if (!activeReview) {
    return NextResponse.json({ error: 'No active approval found' }, { status: 400 })
  }

  const now = new Date()

  if (decision === 'APPROVED') {
    await prisma.documentReview.update({
      where: { id: activeReview.id },
      data: { status: 'APPROVED', comments, reviewedAt: now },
    })

    // Check if ALL approvers have now approved (exclude REMOVED — they no longer count)
    const pendingApprovers = document.reviews.filter(
      (r) => r.isApprover && r.id !== activeReview.id && r.status !== 'APPROVED' && r.status !== 'REMOVED'
    )

    if (pendingApprovers.length === 0) {
      // All approvers done — check for authorizers
      const authorizerReviews = document.reviews.filter(
        (r) => r.isAuthorizer && r.status !== 'REMOVED'
      )

      const appUrl = process.env.APP_URL || 'http://localhost:3000'
      const documentUrl = `${appUrl}/documents/${id}`

      if (authorizerReviews.length > 0) {
        // Activate authorizer stage
        const now2 = new Date()
        const deadline = document.reviewDeadlineDays ? calcDeadline(now2, document.reviewDeadlineDays) : null
        const authorizerIds = authorizerReviews.map((r) => r.id)

        await prisma.$transaction([
          prisma.documentReview.updateMany({
            where: { id: { in: authorizerIds } },
            data: { status: 'IN_PROGRESS', startedAt: now2, deadline },
          }),
          prisma.document.update({
            where: { id },
            data: { status: 'PENDING_AUTHORIZATION' },
          }),
        ])

        // Notify authorizers
        authorizerReviews.forEach((r) => {
          createNotification(
            r.reviewer.id,
            'REVIEW_ASSIGNED',
            `Authorization Required: ${document.title}`,
            `${document.uploadedBy.name} requires your authorization for "${document.title}".`,
            id,
          )
        })

        await sendBulkReviewNotificationsAsync(authorizerReviews.map((r) => ({
          toEmail: r.reviewer.email,
          toName: r.reviewer.name,
          documentTitle: document.title,
          documentUrl,
          sharePointUrl: document.sharePointUrl,
          deadline: deadline?.toISOString() ?? null,
          isApprover: true,
          uploaderName: document.uploadedBy.name,
        }))).catch((e) => console.error('[approve] authorizer email error:', e))

        emitDocStatusChange(id, document.title, 'PENDING_AUTHORIZATION')
        authorizerReviews.forEach((r) => emitReviewAssigned(r.reviewer.id, id, document.title))

      } else {
        // No authorizers — fully approved
        await prisma.document.update({
          where: { id },
          data: { status: 'APPROVED' },
        })
        // Notify originator: document is fully approved
        createNotification(
          document.uploadedBy.id,
          'APPROVED',
          `Document Approved: ${document.title}`,
          `"${document.title}" has been fully approved by all approvers.`,
          id,
        )
        // Build recipient list: uploader + originator (deduplicated, excluding self)
        const approvedRecipients = new Map<string, { name: string; email: string }>()
        approvedRecipients.set(document.uploadedBy.id, { name: document.uploadedBy.name, email: document.uploadedBy.email })
        if (document.originatorUser && document.originatorUser.id !== document.uploadedBy.id) {
          approvedRecipients.set(document.originatorUser.id, { name: document.originatorUser.name, email: document.originatorUser.email })
        }
        approvedRecipients.delete(session.userId)
        const approvedEmails: Promise<void>[] = []
        for (const r of approvedRecipients.values()) {
          approvedEmails.push(
            sendDocControllerNotification({ toEmail: r.email, toName: r.name, documentTitle: document.title, documentUrl, stage: 'APPROVED' })
              .catch((e) => console.error('[approve] approved email error:', e))
          )
        }
        await Promise.all(approvedEmails)
        emitDocStatusChange(id, document.title, 'APPROVED')
      }
    }
    // else: other approvers still reviewing — no document status change yet
  } else {
    // Rejected — halt all other active approvers
    await prisma.$transaction([
      prisma.documentReview.update({
        where: { id: activeReview.id },
        data: { status: 'REJECTED', comments, reviewedAt: now },
      }),
      prisma.documentReview.updateMany({
        where: { documentId: id, isApprover: true, status: 'IN_PROGRESS', id: { not: activeReview.id } },
        data: { status: 'PENDING', startedAt: null },
      }),
      prisma.document.update({
        where: { id },
        data: { status: 'REJECTED' },
      }),
    ])
    // Notify originator: document rejected, back with them
    createNotification(
      document.uploadedBy.id,
      'REJECTED',
      `Document Rejected: ${document.title}`,
      `"${document.title}" was rejected by ${session.name}.${comments ? ` Comment: ${comments}` : ''}`,
      id,
    )
    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    const rejectedRecipients = new Map<string, { name: string; email: string }>()
    rejectedRecipients.set(document.uploadedBy.id, { name: document.uploadedBy.name, email: document.uploadedBy.email })
    if (document.originatorUser && document.originatorUser.id !== document.uploadedBy.id) {
      rejectedRecipients.set(document.originatorUser.id, { name: document.originatorUser.name, email: document.originatorUser.email })
    }
    rejectedRecipients.delete(session.userId)
    const rejectedEmails: Promise<void>[] = []
    for (const r of rejectedRecipients.values()) {
      rejectedEmails.push(
        sendDocControllerNotification({ toEmail: r.email, toName: r.name, documentTitle: document.title, documentUrl: `${appUrl}/documents/${id}`, stage: 'REJECTED' })
          .catch((e) => console.error('[approve] rejected email error:', e))
      )
    }
    await Promise.all(rejectedEmails)
  }

  // Real-time push
  if (decision === 'REJECTED') {
    emitDocStatusChange(id, document.title, 'REJECTED')
  }
  // The APPROVED / PENDING_AUTHORIZATION branch already emits via the authorizer activation above

  prisma.documentActivity.create({
    data: {
      documentId: id,
      userId: session.userId,
      action: decision === 'APPROVED' ? 'APPROVED' : 'REJECTED',
      details: comments || undefined,
    },
  }).catch(() => {})

  const updated = await prisma.document.findUnique({
    where: { id },
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

  return NextResponse.json(updated)
}
