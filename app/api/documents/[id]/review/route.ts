import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { calcDeadline } from '@/lib/sla'
import { sendBulkReviewNotifications, sendOriginatorNotification } from '@/lib/email'
import { createNotification } from '@/lib/notify'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { decision, comments } = await request.json()

  if (!['APPROVED', 'REJECTED', 'CHANGES_REQUESTED'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }

  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true, title: true, status: true,
      sharePointUrl: true, reviewDeadlineDays: true,
      uploadedBy: { select: { id: true, name: true, email: true } },
      reviews: {
        include: { reviewer: { select: { id: true, name: true, email: true } } },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (document.status !== 'IN_REVIEW') {
    return NextResponse.json({ error: 'Document is not in review' }, { status: 400 })
  }

  // Only reviewer-type reviews are active during IN_REVIEW
  let myReview = document.reviews.find(
    (r) => !r.isApprover && r.reviewerId === session.userId && r.status === 'IN_PROGRESS'
  )

  // Fallback: if the review exists but is still PENDING (e.g. document submitted before
  // parallel activation was deployed), activate it now so the reviewer is not locked out.
  if (!myReview) {
    const pendingReview = document.reviews.find(
      (r) => !r.isApprover && r.reviewerId === session.userId && r.status === 'PENDING'
    )
    if (pendingReview) {
      await prisma.documentReview.update({
        where: { id: pendingReview.id },
        data: { status: 'IN_PROGRESS', startedAt: new Date() },
      })
      myReview = { ...pendingReview, status: 'IN_PROGRESS', startedAt: new Date() } as typeof pendingReview
    }
  }

  if (!myReview) {
    return NextResponse.json({ error: 'No active review assigned to you' }, { status: 403 })
  }

  const now = new Date()

  const activityAction =
    decision === 'APPROVED' ? 'REVIEW_APPROVED' :
    decision === 'REJECTED' ? 'REVIEW_REJECTED' : 'REVIEW_CHANGES_REQUESTED'

  if (decision === 'APPROVED') {
    await prisma.documentReview.update({
      where: { id: myReview.id },
      data: { status: 'APPROVED', comments, reviewedAt: now },
    })

    // Check if ALL reviewers have now approved
    const pendingReviewers = document.reviews.filter(
      (r) => !r.isApprover && r.id !== myReview.id && r.status !== 'APPROVED'
    )

    if (pendingReviewers.length === 0) {
      // All reviewers done — activate all approvers simultaneously, or mark approved
      // All reviewers approved — return document to manager to clean up before approval
      await prisma.document.update({
        where: { id },
        data: { status: 'REVIEW_COMPLETE' },
      })
      // Notify document manager: all reviews done, ready to send for approval
      createNotification(
        document.uploadedBy.id,
        'REVIEW_COMPLETE',
        `Review Complete: ${document.title}`,
        `All reviewers have completed their review of "${document.title}". Ready to advance to approval.`,
        id,
      )
      const appUrl = process.env.APP_URL || 'http://localhost:3000'
      sendOriginatorNotification({
        toEmail: document.uploadedBy.email,
        toName: document.uploadedBy.name,
        documentTitle: document.title,
        documentUrl: `${appUrl}/documents/${id}`,
        outcome: 'REVIEW_COMPLETE' as never,
        reviewerName: session.name,
        reviewerComments: comments || null,
      }).catch(() => {})
    }
    // else: other reviewers are still reviewing — no document status change yet
  } else {
    // Rejected or changes requested — halt all other active reviewers
    await prisma.$transaction([
      prisma.documentReview.update({
        where: { id: myReview.id },
        data: { status: decision, comments, reviewedAt: now },
      }),
      prisma.documentReview.updateMany({
        where: { documentId: id, isApprover: false, status: 'IN_PROGRESS', id: { not: myReview.id } },
        data: { status: 'PENDING', startedAt: null },
      }),
      prisma.document.update({
        where: { id },
        data: { status: decision === 'REJECTED' ? 'REJECTED' : 'CHANGES_REQUESTED' },
      }),
    ])
    // Notify originator the document is back with them
    createNotification(
      document.uploadedBy.id,
      decision === 'REJECTED' ? 'REJECTED' : 'CHANGES_REQUESTED',
      `Document ${decision === 'REJECTED' ? 'Rejected' : 'Changes Requested'}: ${document.title}`,
      `${session.name} has ${decision === 'REJECTED' ? 'rejected' : 'requested changes on'} "${document.title}".${comments ? ` Comment: ${comments}` : ''}`,
      id,
    )
    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    sendOriginatorNotification({
      toEmail: document.uploadedBy.email,
      toName: document.uploadedBy.name,
      documentTitle: document.title,
      documentUrl: `${appUrl}/documents/${id}`,
      outcome: decision === 'REJECTED' ? 'REJECTED' : 'CHANGES_REQUESTED',
      reviewerName: session.name,
      reviewerComments: comments || null,
    }).catch(() => {})
  }

  prisma.documentActivity.create({
    data: {
      documentId: id,
      userId: session.userId,
      action: activityAction as 'REVIEW_APPROVED' | 'REVIEW_REJECTED' | 'REVIEW_CHANGES_REQUESTED',
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
