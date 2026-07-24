import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { calcDeadline } from '@/lib/sla'
import { sendBulkReviewNotificationsAsync } from '@/lib/email'
import { signReviewToken } from '@/lib/reviewToken'
import { createNotification } from '@/lib/notify'

/**
 * POST /api/documents/[id]/resubmit-for-approval
 *
 * Used when a document was REJECTED by an approver.
 * The originator amends it (replacing the file via amend-file if needed),
 * then the document manager sends it straight back to approval —
 * bypassing the review stage entirely.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true, title: true, status: true,
      uploadedById: true, sharePointUrl: true, reviewDeadlineDays: true,
      uploadedBy: { select: { name: true, email: true } },
      reviews: {
        include: { reviewer: { select: { id: true, name: true, email: true } } },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (document.uploadedById !== session.userId && session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (document.status !== 'REJECTED') {
    return NextResponse.json({ error: 'Only rejected documents can be resubmitted for approval' }, { status: 400 })
  }

  const approverReviews = document.reviews.filter((r) => r.isApprover)
  if (approverReviews.length === 0) {
    return NextResponse.json({ error: 'No approvers assigned to this document' }, { status: 400 })
  }

  const now = new Date()
  const deadline = document.reviewDeadlineDays ? calcDeadline(now, document.reviewDeadlineDays) : null
  const approverIds = approverReviews.map((r) => r.id)

  // Reset all approver reviews to IN_PROGRESS — reviewer reviews remain APPROVED
  await prisma.$transaction([
    prisma.documentReview.updateMany({
      where: { id: { in: approverIds } },
      data: { status: 'IN_PROGRESS', startedAt: now, reviewedAt: null, comments: null, deadline },
    }),
    prisma.document.update({
      where: { id },
      data: { status: 'FINAL_DRAFT' },
    }),
  ])

  // In-app notifications for all approvers
  approverReviews.forEach((r) => {
    createNotification(
      r.reviewer.id,
      'REVIEW_ASSIGNED',
      `Re-Approval Required: ${document.title}`,
      `${document.uploadedBy.name} has resubmitted "${document.title}" for your approval following revision.`,
      id,
    )
  })

  // Email all approvers
  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  try {
    const notifications = await Promise.all(
      approverReviews.map(async (r) => {
        const reviewToken = await signReviewToken({
          documentId: id,
          reviewId: r.id,
          reviewerId: r.reviewer.id,
          isApprover: true,
        })
        return {
          toEmail: r.reviewer.email,
          toName: r.reviewer.name,
          documentTitle: document.title,
          documentUrl: `${appUrl}/documents/${id}`,
          reviewUrl: `${appUrl}/review/${reviewToken}`,
          sharePointUrl: document.sharePointUrl,
          deadline: deadline?.toISOString() ?? null,
          isApprover: true,
          uploaderName: document.uploadedBy.name,
        }
      })
    )
    await sendBulkReviewNotificationsAsync(notifications)
  } catch (err) {
    console.error('[resubmit-for-approval] email error:', err)
  }

  prisma.documentActivity.create({
    data: {
      documentId: id,
      userId: session.userId,
      action: 'SUBMITTED',
      details: 'Resubmitted for re-approval after rejection (review stage bypassed)',
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
