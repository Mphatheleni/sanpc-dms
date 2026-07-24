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
      uploadedBy: { select: { name: true } },
      reviews: {
        include: { reviewer: { select: { id: true, name: true, email: true } } },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const canManage =
    document.uploadedById === session.userId ||
    session.role === 'ADMIN' ||
    session.role === 'DOCUMENT_MANAGER'
  if (!canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { newReviewerId, isApprover } = await req.json()
  if (!newReviewerId) return NextResponse.json({ error: 'newReviewerId is required' }, { status: 400 })

  const terminalStatuses = ['APPROVED', 'CONTROLLED', 'SUPERSEDED', 'CANCELLED']
  if (terminalStatuses.includes(document.status)) {
    return NextResponse.json({ error: 'Cannot modify workflow of a finalised document' }, { status: 400 })
  }

  // Active statuses where the new person should be immediately notified
  const activeStatuses = isApprover ? ['PENDING_APPROVAL', 'FINAL_DRAFT'] : ['IN_REVIEW']
  const isActiveAdd = activeStatuses.includes(document.status)

  // Prevent duplicates
  const alreadyAssigned = document.reviews.some((r) => r.reviewerId === newReviewerId)
  if (alreadyAssigned) {
    return NextResponse.json({ error: 'This person is already in the review workflow' }, { status: 400 })
  }

  const newReviewer = await prisma.user.findUnique({
    where: { id: newReviewerId },
    select: { id: true, name: true, email: true },
  })
  if (!newReviewer) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const now = new Date()
  const deadline = document.reviewDeadlineDays ? calcDeadline(now, document.reviewDeadlineDays) : null
  const maxOrder = document.reviews.reduce((max, r) => Math.max(max, r.order), 0)

  const newReview = await prisma.documentReview.create({
    data: {
      documentId: id,
      reviewerId: newReviewerId,
      order: maxOrder + 1,
      isApprover: !!isApprover,
      // If document is already in an active review stage, start immediately; otherwise keep PENDING until submit
      status: isActiveAdd ? 'IN_PROGRESS' : 'PENDING',
      startedAt: isActiveAdd ? now : null,
      deadline: isActiveAdd ? deadline : null,
    },
  })

  // Only email if the document is already active — otherwise they'll be notified on submit
  if (isActiveAdd) {
    const reviewToken = await signReviewToken({
      documentId: id,
      reviewId: newReview.id,
      reviewerId: newReviewerId,
      isApprover: !!isApprover,
    })
    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    try {
      await sendReviewNotification({
        toEmail: newReviewer.email,
        toName: newReviewer.name,
        documentTitle: document.title,
        documentUrl: `${appUrl}/documents/${id}`,
        reviewUrl: `${appUrl}/review/${reviewToken}`,
        sharePointUrl: document.sharePointUrl,
        deadline: deadline?.toISOString() ?? null,
        isApprover: !!isApprover,
        uploaderName: document.uploadedBy.name,
      })
    } catch (err) {
      console.error('[add-reviewer] email error:', err)
    }
  }

  prisma.documentActivity.create({
    data: {
      documentId: id,
      userId: session.userId,
      action: 'AMENDED',
      details: `${isApprover ? 'Approver' : 'Reviewer'} ${newReviewer.name} added to workflow`,
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
