import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendOriginatorNotification } from '@/lib/email'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.role !== 'APPROVER' && session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { decision, comments } = await request.json()

  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      reviews: { orderBy: { order: 'asc' } },
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
  })

  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (document.status !== 'PENDING_APPROVAL') {
    return NextResponse.json({ error: 'Document is not pending approval' }, { status: 400 })
  }

  // Find this user's active approver review
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

    // Check if ALL approvers have now approved
    const pendingApprovers = document.reviews.filter(
      (r) => r.isApprover && r.id !== activeReview.id && r.status !== 'APPROVED'
    )

    if (pendingApprovers.length === 0) {
      // All approvers done — fully approved
      await prisma.document.update({
        where: { id },
        data: { status: 'APPROVED' },
      })
      // Notify originator: document is fully approved
      const appUrl = process.env.APP_URL || 'http://localhost:3000'
      sendOriginatorNotification({
        toEmail: document.uploadedBy.email,
        toName: document.uploadedBy.name,
        documentTitle: document.title,
        documentUrl: `${appUrl}/documents/${id}`,
        outcome: 'APPROVED',
        reviewerName: session.name,
        reviewerComments: comments || null,
      }).catch(() => {})
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
    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    sendOriginatorNotification({
      toEmail: document.uploadedBy.email,
      toName: document.uploadedBy.name,
      documentTitle: document.title,
      documentUrl: `${appUrl}/documents/${id}`,
      outcome: 'REJECTED',
      reviewerName: session.name,
      reviewerComments: comments || null,
    }).catch(() => {})
  }

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
