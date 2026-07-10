import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { calcDeadline } from '@/lib/sla'
import { sendBulkReviewNotifications } from '@/lib/email'
import { signReviewToken } from '@/lib/reviewToken'
import { createNotification } from '@/lib/notify'

/**
 * POST /api/documents/[id]/advance
 * Document manager sends a REVIEW_COMPLETE document to the approval stage.
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
      uploadedBy: { select: { name: true } },
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

  if (document.status !== 'REVIEW_COMPLETE') {
    return NextResponse.json({ error: 'Document is not ready to advance to approval' }, { status: 400 })
  }

  const approverReviews = document.reviews.filter((r) => r.isApprover)

  if (approverReviews.length === 0) {
    // No approvers configured — mark as fully approved
    await prisma.document.update({ where: { id }, data: { status: 'APPROVED' } })
  } else {
    const now = new Date()
    const deadline = document.reviewDeadlineDays ? calcDeadline(now, document.reviewDeadlineDays) : null

    const approverIds = approverReviews.map((r) => r.id)
    await prisma.$transaction([
      prisma.documentReview.updateMany({
        where: { id: { in: approverIds } },
        data: { status: 'IN_PROGRESS', startedAt: now, deadline },
      }),
      prisma.document.update({
        where: { id },
        data: { status: 'PENDING_APPROVAL' },
      }),
    ])

    // In-app notifications for all approvers
    approverReviews.forEach((r) => {
      createNotification(
        r.reviewer.id,
        'REVIEW_ASSIGNED',
        `Approval Assigned: ${document.title}`,
        `${document.uploadedBy.name} requires your approval for "${document.title}".`,
        id,
      )
    })

    // Notify all approvers with signed token links
    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    Promise.all(
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
    ).then((notifications) => sendBulkReviewNotifications(notifications)).catch(() => {})
  }

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
