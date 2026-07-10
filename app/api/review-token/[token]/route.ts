import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyReviewToken } from '@/lib/reviewToken'
import { sendOriginatorNotification, sendBulkReviewNotifications } from '@/lib/email'
import { calcDeadline } from '@/lib/sla'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const payload = await verifyReviewToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired review link' }, { status: 401 })
  }

  const { documentId, reviewId, reviewerId, isApprover } = payload
  const { decision, comments } = await request.json()

  // Validate decision
  const validDecisions = isApprover ? ['APPROVED', 'REJECTED'] : ['APPROVED']
  if (!validDecisions.includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }

  const document = await prisma.document.findUnique({
    where: { id: documentId },
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

  if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const expectedStatus = isApprover ? ['PENDING_APPROVAL', 'FINAL_DRAFT'] : ['IN_REVIEW']
  if (!expectedStatus.includes(document.status)) {
    return NextResponse.json(
      { error: 'This document is no longer awaiting your ' + (isApprover ? 'approval' : 'review') },
      { status: 409 }
    )
  }

  // Find the review record — auto-activate if stuck in PENDING (backward compat)
  let myReview = document.reviews.find(
    (r) => r.id === reviewId && r.reviewerId === reviewerId && r.status === 'IN_PROGRESS'
  )
  if (!myReview) {
    const pendingReview = document.reviews.find(
      (r) => r.id === reviewId && r.reviewerId === reviewerId && r.status === 'PENDING'
    )
    if (pendingReview) {
      await prisma.documentReview.update({
        where: { id: pendingReview.id },
        data: { status: 'IN_PROGRESS', startedAt: new Date() },
      })
      myReview = { ...pendingReview, status: 'IN_PROGRESS' as const, startedAt: new Date() }
    }
  }

  if (!myReview) {
    return NextResponse.json(
      { error: 'This review has already been submitted or is no longer active' },
      { status: 409 }
    )
  }

  const now = new Date()
  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  const reviewerRecord = document.reviews.find((r) => r.reviewerId === reviewerId)
  const reviewerName = reviewerRecord?.reviewer.name ?? 'Reviewer'

  // ── REVIEWER logic ─────────────────────────────────────────────────────────
  if (!isApprover) {
    await prisma.documentReview.update({
      where: { id: reviewId },
      data: { status: 'APPROVED', comments, reviewedAt: now },
    })

    const pendingReviewers = document.reviews.filter(
      (r) => !r.isApprover && r.id !== reviewId && r.status !== 'APPROVED'
    )

    if (pendingReviewers.length === 0) {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'UPDATING' },
      })
      sendOriginatorNotification({
        toEmail: document.uploadedBy.email,
        toName: document.uploadedBy.name,
        documentTitle: document.title,
        documentUrl: `${appUrl}/documents/${documentId}`,
        outcome: 'REVIEW_COMPLETE',
        reviewerName,
        reviewerComments: comments || null,
      }).catch(() => {})
    } else {
      // Notify doc manager that this specific reviewer has submitted
      sendOriginatorNotification({
        toEmail: document.uploadedBy.email,
        toName: document.uploadedBy.name,
        documentTitle: document.title,
        documentUrl: `${appUrl}/documents/${documentId}`,
        outcome: 'REVIEWER_COMPLETE',
        reviewerName,
        reviewerComments: comments || null,
      }).catch(() => {})
    }

    prisma.documentActivity.create({
      data: { documentId, userId: reviewerId, action: 'REVIEW_APPROVED', details: comments || undefined },
    }).catch(() => {})

    return NextResponse.json({ ok: true, message: 'Review marked as complete' })
  }

  // ── APPROVER logic ──────────────────────────────────────────────────────────
  if (decision === 'APPROVED') {
    await prisma.documentReview.update({
      where: { id: reviewId },
      data: { status: 'APPROVED', comments, reviewedAt: now },
    })

    const pendingApprovers = document.reviews.filter(
      (r) => r.isApprover && r.id !== reviewId && r.status !== 'APPROVED'
    )

    if (pendingApprovers.length === 0) {
      await prisma.document.update({ where: { id: documentId }, data: { status: 'APPROVED' } })
      sendOriginatorNotification({
        toEmail: document.uploadedBy.email,
        toName: document.uploadedBy.name,
        documentTitle: document.title,
        documentUrl: `${appUrl}/documents/${documentId}`,
        outcome: 'APPROVED',
        reviewerName,
        reviewerComments: comments || null,
      }).catch(() => {})
    }

    prisma.documentActivity.create({
      data: { documentId, userId: reviewerId, action: 'APPROVED', details: comments || undefined },
    }).catch(() => {})

    return NextResponse.json({ ok: true, message: 'Document approved' })
  }

  // REJECTED
  await prisma.$transaction([
    prisma.documentReview.update({
      where: { id: reviewId },
      data: { status: 'REJECTED', comments, reviewedAt: now },
    }),
    prisma.documentReview.updateMany({
      where: { documentId, isApprover: true, status: 'IN_PROGRESS', id: { not: reviewId } },
      data: { status: 'PENDING', startedAt: null },
    }),
    prisma.document.update({ where: { id: documentId }, data: { status: 'REJECTED' } }),
  ])

  sendOriginatorNotification({
    toEmail: document.uploadedBy.email,
    toName: document.uploadedBy.name,
    documentTitle: document.title,
    documentUrl: `${appUrl}/documents/${documentId}`,
    outcome: 'REJECTED',
    reviewerName,
    reviewerComments: comments || null,
  }).catch(() => {})

  prisma.documentActivity.create({
    data: { documentId, userId: reviewerId, action: 'REJECTED', details: comments || undefined },
  }).catch(() => {})

  return NextResponse.json({ ok: true, message: 'Document rejected' })
}

// GET — check status of this review token (used by the page to check if already submitted)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const payload = await verifyReviewToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired review link' }, { status: 401 })
  }

  const { documentId, reviewId, reviewerId, isApprover } = payload

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true, title: true, description: true, status: true,
      sharePointUrl: true, reviewDeadlineDays: true,
      uploadedBy: { select: { name: true } },
      reviews: {
        where: { id: reviewId },
        include: { reviewer: { select: { name: true, email: true } } },
      },
    },
  })

  if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const review = document.reviews[0]

  return NextResponse.json({
    documentId,
    documentTitle: document.title,
    documentDescription: document.description,
    documentStatus: document.status,
    sharePointUrl: document.sharePointUrl,
    uploaderName: document.uploadedBy.name,
    reviewerName: review?.reviewer.name,
    reviewStatus: review?.status,
    deadline: review?.deadline,
    isApprover,
  })
}
