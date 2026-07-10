import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { calcDeadline } from '@/lib/sla'
import { signReviewToken } from '@/lib/reviewToken'
import { sendReviewNotification } from '@/lib/email'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true, title: true, status: true,
      uploadedById: true, sharePointUrl: true, reviewDeadlineDays: true,
      uploadedBy: { select: { id: true, name: true, email: true } },
      reviews: {
        include: { reviewer: { select: { id: true, name: true, email: true } } },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only uploader, ADMIN, or DOCUMENT_MANAGER can replace reviewers
  const canManage =
    document.uploadedById === session.userId ||
    session.role === 'ADMIN' ||
    session.role === 'DOCUMENT_MANAGER'
  if (!canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Only allowed when document is actively in review or approval
  if (document.status !== 'IN_REVIEW' && document.status !== 'PENDING_APPROVAL') {
    return NextResponse.json(
      { error: 'Reviewer replacement is only allowed while the document is IN_REVIEW or PENDING_APPROVAL' },
      { status: 400 },
    )
  }

  const { reviewId, newReviewerId } = await req.json()
  if (!reviewId || !newReviewerId) {
    return NextResponse.json({ error: 'reviewId and newReviewerId are required' }, { status: 400 })
  }

  const existingReview = document.reviews.find((r) => r.id === reviewId)
  if (!existingReview) {
    return NextResponse.json({ error: 'Review record not found on this document' }, { status: 404 })
  }

  if (existingReview.status !== 'IN_PROGRESS') {
    return NextResponse.json(
      { error: 'Only IN_PROGRESS reviews can be reassigned' },
      { status: 400 },
    )
  }

  // Prevent assigning someone already on the workflow
  const alreadyAssigned = document.reviews.some(
    (r) => r.reviewerId === newReviewerId && r.id !== reviewId,
  )
  if (alreadyAssigned) {
    return NextResponse.json(
      { error: 'This person is already in the review workflow' },
      { status: 400 },
    )
  }

  // Fetch the new reviewer
  const newReviewer = await prisma.user.findUnique({
    where: { id: newReviewerId },
    select: { id: true, name: true, email: true, role: true },
  })
  if (!newReviewer) return NextResponse.json({ error: 'New reviewer not found' }, { status: 404 })

  const now = new Date()
  const deadline = document.reviewDeadlineDays
    ? calcDeadline(now, document.reviewDeadlineDays)
    : null

  // Update the review record: swap reviewer, keep IN_PROGRESS, fresh timestamps
  await prisma.documentReview.update({
    where: { id: reviewId },
    data: {
      reviewerId: newReviewerId,
      status: 'IN_PROGRESS',
      startedAt: now,
      deadline,
      reviewedAt: null,
      comments: null,
    },
  })

  // Sign a new JWT token for the replacement reviewer
  const reviewToken = await signReviewToken({
    documentId: id,
    reviewId,
    reviewerId: newReviewerId,
    isApprover: existingReview.isApprover,
  })

  // Send email to the new reviewer (fire-and-forget)
  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  sendReviewNotification({
    toEmail: newReviewer.email,
    toName: newReviewer.name,
    documentTitle: document.title,
    documentUrl: `${appUrl}/documents/${id}`,
    reviewUrl: `${appUrl}/review/${reviewToken}`,
    sharePointUrl: document.sharePointUrl,
    deadline: deadline?.toISOString() ?? null,
    isApprover: existingReview.isApprover,
    uploaderName: document.uploadedBy.name,
  }).catch(() => {})

  // Return updated document
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
