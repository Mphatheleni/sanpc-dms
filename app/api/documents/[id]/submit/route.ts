import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { calcDeadline } from '@/lib/sla'
import { sendBulkReviewNotifications } from '@/lib/email'
import { signReviewToken } from '@/lib/reviewToken'
import { createNotification } from '@/lib/notify'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true, title: true, status: true, version: true,
      fileUrl: true, fileName: true, fileType: true, fileSize: true,
      uploadedById: true, sharePointUrl: true, reviewDeadlineDays: true,
      reviews: {
        include: { reviewer: { select: { id: true, name: true, email: true } } },
        orderBy: { order: 'asc' },
      },
    },
  })

  console.log(`[submit] id=${id} document=${document ? 'found' : 'NOT FOUND'}`)
  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (document.uploadedById !== session.userId && session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const submittableStatuses = ['REGISTERED', 'DRAFT', 'CHANGES_REQUESTED', 'REJECTED']
  if (!submittableStatuses.includes(document.status)) {
    return NextResponse.json({ error: 'Document cannot be submitted in its current status' }, { status: 400 })
  }

  if (!document.reviews.length) {
    return NextResponse.json({ error: 'No reviewers or approvers assigned' }, { status: 400 })
  }

  const reviewerReviews = document.reviews.filter((r) => !r.isApprover)
  const approverReviews = document.reviews.filter((r) => r.isApprover)

  const now = new Date()
  let newVersion = document.version

  // Snapshot current file as a version when resubmitting after changes or rejection
  if (document.status === 'CHANGES_REQUESTED' || document.status === 'REJECTED' || document.status === 'UPDATING' || document.status === 'REVIEW_COMPLETE') {
    await prisma.documentVersion.create({
      data: {
        documentId: id,
        versionNumber: document.version,
        fileUrl: document.fileUrl,
        fileName: document.fileName,
        fileType: document.fileType,
        fileSize: document.fileSize,
        uploadedById: document.uploadedById,
      },
    })
    newVersion = document.version + 1
  }

  // Deadline for each review (startedAt + reviewDeadlineDays)
  const deadlineDays = document.reviewDeadlineDays
  const deadline = deadlineDays ? calcDeadline(now, deadlineDays) : null

  // Reset all reviews to PENDING
  await prisma.documentReview.updateMany({
    where: { documentId: id },
    data: { status: 'PENDING', startedAt: null, reviewedAt: null, comments: null, deadline: null },
  })

  // Which group to activate first
  const activateReviewers = reviewerReviews.length > 0
  const groupToActivate = activateReviewers ? reviewerReviews : approverReviews
  const activateIds = groupToActivate.map((r) => r.id)
  const newDocStatus = activateReviewers ? 'IN_REVIEW' : 'PENDING_APPROVAL'

  // Activate all members of the first group with startedAt + deadline (use explicit IDs)
  await prisma.$transaction([
    prisma.documentReview.updateMany({
      where: { id: { in: activateIds } },
      data: { status: 'IN_PROGRESS', startedAt: now, deadline },
    }),
    prisma.document.update({
      where: { id },
      data: { status: newDocStatus as never, version: newVersion },
    }),
  ])

  // In-app notifications for all activated reviewers/approvers
  groupToActivate.forEach((r) => {
    createNotification(
      r.reviewer.id,
      'REVIEW_ASSIGNED',
      `Review Assigned: ${document.title}`,
      `${session.name} has assigned you to review "${document.title}".`,
      id,
    )
  })

  // Fire-and-forget: email all activated reviewers/approvers with signed token links
  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  Promise.all(
    groupToActivate.map(async (r) => {
      const reviewToken = await signReviewToken({
        documentId: id,
        reviewId: r.id,
        reviewerId: r.reviewer.id,
        isApprover: !activateReviewers,
      })
      return {
        toEmail: r.reviewer.email,
        toName: r.reviewer.name,
        documentTitle: document.title,
        documentUrl: `${appUrl}/documents/${id}`,
        reviewUrl: `${appUrl}/review/${reviewToken}`,
        sharePointUrl: document.sharePointUrl,
        deadline: deadline?.toISOString() ?? null,
        isApprover: !activateReviewers,
        uploaderName: session.name,
      }
    })
  ).then((notifications) => sendBulkReviewNotifications(notifications)).catch(() => {})

  prisma.documentActivity.create({
    data: {
      documentId: id,
      userId: session.userId,
      action: 'SUBMITTED',
      details: (document.status === 'CHANGES_REQUESTED' || document.status === 'REJECTED') ? `Resubmitted as v${newVersion}` : undefined,
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
