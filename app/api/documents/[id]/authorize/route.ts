import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendBulkReviewNotificationsAsync, sendDocControllerNotification } from '@/lib/email'
import { createNotification } from '@/lib/notify'
import { calcDeadline } from '@/lib/sla'
import { emitDocStatusChange } from '@/lib/realtime'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { decision, comments: rawComments } = await request.json()
  const comments = rawComments?.trim() ? rawComments.trim() : 'No comment'

  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      reviews: { orderBy: { order: 'asc' } },
      uploadedBy: { select: { id: true, name: true, email: true } },
      originatorUser: { select: { id: true, name: true, email: true } },
    },
  })

  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (document.status !== 'PENDING_AUTHORIZATION') {
    return NextResponse.json({ error: 'Document is not pending authorization' }, { status: 400 })
  }

  const myReview = document.reviews.find(
    (r) => r.isAuthorizer && r.reviewerId === session.userId && r.status === 'IN_PROGRESS'
  )

  if (!myReview && session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No active authorization assigned to you' }, { status: 403 })
  }

  const activeReview = myReview ?? document.reviews.find((r) => r.isAuthorizer && r.status === 'IN_PROGRESS')
  if (!activeReview) {
    return NextResponse.json({ error: 'No active authorization found' }, { status: 400 })
  }

  const now = new Date()
  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  const documentUrl = `${appUrl}/documents/${id}`

  if (decision === 'APPROVED') {
    await prisma.documentReview.update({
      where: { id: activeReview.id },
      data: { status: 'APPROVED', comments, reviewedAt: now },
    })

    // Check if all authorizers have approved (exclude REMOVED)
    const pendingAuthorizers = document.reviews.filter(
      (r) => r.isAuthorizer && r.id !== activeReview.id && r.status !== 'APPROVED' && r.status !== 'REMOVED'
    )

    if (pendingAuthorizers.length === 0) {
      // All authorizers done — move to APPROVED
      await prisma.document.update({
        where: { id },
        data: { status: 'APPROVED' },
      })

      createNotification(
        document.uploadedBy.id,
        'APPROVED',
        `Document Authorized: ${document.title}`,
        `"${document.title}" has been authorized by all authorizers and is now Approved.`,
        id,
      )

      // Notify uploader + originator
      const authApprovedRecipients = new Map<string, { name: string; email: string }>()
      authApprovedRecipients.set(document.uploadedBy.id, { name: document.uploadedBy.name, email: document.uploadedBy.email })
      if (document.originatorUser && document.originatorUser.id !== document.uploadedBy.id) {
        authApprovedRecipients.set(document.originatorUser.id, { name: document.originatorUser.name, email: document.originatorUser.email })
      }
      authApprovedRecipients.delete(session.userId)
      await Promise.all([...authApprovedRecipients.values()].map((r) =>
        sendDocControllerNotification({ toEmail: r.email, toName: r.name, documentTitle: document.title, documentUrl, stage: 'AUTHORIZED' })
          .catch((e) => console.error('[authorize] approved email error:', e))
      ))
      emitDocStatusChange(id, document.title, 'APPROVED')
    }
    // else: other authorizers still pending — no document status change yet

  } else {
    // Rejected — reset other in-progress authorizer reviews
    await prisma.$transaction([
      prisma.documentReview.update({
        where: { id: activeReview.id },
        data: { status: 'REJECTED', comments, reviewedAt: now },
      }),
      prisma.documentReview.updateMany({
        where: { documentId: id, isAuthorizer: true, status: 'IN_PROGRESS', id: { not: activeReview.id } },
        data: { status: 'PENDING', startedAt: null },
      }),
      prisma.document.update({
        where: { id },
        data: { status: 'REJECTED' },
      }),
    ])

    createNotification(
      document.uploadedBy.id,
      'REJECTED',
      `Document Rejected: ${document.title}`,
      `"${document.title}" was rejected by ${session.name} at the authorization stage.${comments ? ` Comment: ${comments}` : ''}`,
      id,
    )

    // Notify uploader + originator
    const authRejectedRecipients = new Map<string, { name: string; email: string }>()
    authRejectedRecipients.set(document.uploadedBy.id, { name: document.uploadedBy.name, email: document.uploadedBy.email })
    if (document.originatorUser && document.originatorUser.id !== document.uploadedBy.id) {
      authRejectedRecipients.set(document.originatorUser.id, { name: document.originatorUser.name, email: document.originatorUser.email })
    }
    authRejectedRecipients.delete(session.userId)
    await Promise.all([...authRejectedRecipients.values()].map((r) =>
      sendDocControllerNotification({ toEmail: r.email, toName: r.name, documentTitle: document.title, documentUrl, stage: 'REJECTED' })
        .catch((e) => console.error('[authorize] rejected email error:', e))
    ))
    emitDocStatusChange(id, document.title, 'REJECTED')
  }

  prisma.documentActivity.create({
    data: {
      documentId: id,
      userId: session.userId,
      action: decision === 'APPROVED' ? 'AUTHORIZED' : 'REJECTED',
      details: comments || undefined,
    },
  }).catch(() => {})

  const updated = await prisma.document.findUnique({
    where: { id },
    include: {
      uploadedBy: { select: { id: true, name: true, email: true, role: true } },
      originatorUser: { select: { id: true, name: true, email: true, role: true } },
      authorizerUser: { select: { id: true, name: true, email: true, role: true } },
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
