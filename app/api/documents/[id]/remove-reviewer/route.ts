import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendReviewerRemovedEmail } from '@/lib/email'

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
      uploadedById: true,
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

  const terminalStatuses = ['APPROVED', 'CONTROLLED', 'SUPERSEDED', 'CANCELLED']
  if (terminalStatuses.includes(document.status)) {
    return NextResponse.json({ error: 'Cannot modify workflow of a finalised document' }, { status: 400 })
  }

  const { reviewId } = await req.json()
  if (!reviewId) return NextResponse.json({ error: 'reviewId is required' }, { status: 400 })

  const existingReview = document.reviews.find((r) => r.id === reviewId)
  if (!existingReview) return NextResponse.json({ error: 'Review not found on this document' }, { status: 404 })

  if (existingReview.status === 'APPROVED') {
    return NextResponse.json({ error: 'Cannot remove a reviewer who has already completed their review' }, { status: 400 })
  }

  await prisma.documentReview.delete({ where: { id: reviewId } })

  // Only notify if the reviewer was already active (IN_PROGRESS) — PENDING means they were never emailed
  if (existingReview.status === 'IN_PROGRESS') {
    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    try {
      await sendReviewerRemovedEmail({
        toEmail: existingReview.reviewer.email,
        toName: existingReview.reviewer.name,
        documentTitle: document.title,
        documentUrl: `${appUrl}/documents/${id}`,
      })
    } catch (err) {
      console.error('[remove-reviewer] email error:', err)
    }
  }

  prisma.documentActivity.create({
    data: {
      documentId: id,
      userId: session.userId,
      action: 'AMENDED',
      details: `${existingReview.isApprover ? 'Approver' : 'Reviewer'} ${existingReview.reviewer.name} removed from workflow`,
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
