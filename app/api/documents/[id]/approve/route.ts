import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendOriginatorNotification, sendDocControllerNotification } from '@/lib/email'
import { createNotification } from '@/lib/notify'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
      createNotification(
        document.uploadedBy.id,
        'APPROVED',
        `Document Approved: ${document.title}`,
        `"${document.title}" has been fully approved by all approvers.`,
        id,
      )
      const appUrl = process.env.APP_URL || 'http://localhost:3000'
      // Await both notifications in parallel — Cloud Run would kill fire-and-forget
      await Promise.all([
        sendOriginatorNotification({
          toEmail: document.uploadedBy.email,
          toName: document.uploadedBy.name,
          documentTitle: document.title,
          documentUrl: `${appUrl}/documents/${id}`,
          outcome: 'APPROVED',
          reviewerName: session.name,
          reviewerComments: comments || null,
        }).catch((e) => console.error('[approve] originator email error:', e)),
        sendDocControllerNotification({
          toEmail: document.uploadedBy.email,
          toName: document.uploadedBy.name,
          documentTitle: document.title,
          documentUrl: `${appUrl}/documents/${id}`,
          stage: 'APPROVED',
        }).catch((e) => console.error('[approve] doc controller email error:', e)),
      ])
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
    // Await both notifications in parallel
    await Promise.all([
      sendOriginatorNotification({
        toEmail: document.uploadedBy.email,
        toName: document.uploadedBy.name,
        documentTitle: document.title,
        documentUrl: `${appUrl}/documents/${id}`,
        outcome: 'REJECTED',
        reviewerName: session.name,
        reviewerComments: comments || null,
      }).catch((e) => console.error('[approve] originator email error:', e)),
      sendDocControllerNotification({
        toEmail: document.uploadedBy.email,
        toName: document.uploadedBy.name,
        documentTitle: document.title,
        documentUrl: `${appUrl}/documents/${id}`,
        stage: 'REJECTED',
      }).catch((e) => console.error('[approve] doc controller email error:', e)),
    ])
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
