import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createNotification } from '@/lib/notify'

const docInclude = {
  uploadedBy: { select: { id: true, name: true, email: true, role: true } },
  originatorUser: { select: { id: true, name: true, email: true, role: true } },
  authorizerUser: { select: { id: true, name: true, email: true, role: true } },
  metadata: true,
  reviews: {
    include: { reviewer: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { order: 'asc' as const },
  },
  comments: {
    include: { author: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const document = await prisma.document.findUnique({ where: { id }, include: docInclude })
  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ORIGINATOR can only access documents they originated
  if (session.role === 'ORIGINATOR' && document.originatorId !== session.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // W2: SUPERSEDED documents are restricted to Document Controllers and ADMIN
  if (document.status === 'SUPERSEDED' && session.role !== 'DOCUMENT_MANAGER' && session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  prisma.documentActivity.create({
    data: { documentId: id, userId: session.userId, action: 'VIEWED' },
  }).catch(() => {})

  return NextResponse.json(document)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const document = await prisma.document.findUnique({ where: { id } })
  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session.role !== 'ADMIN' && document.uploadedById !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.document.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const document = await prisma.document.findUnique({ where: { id } })
  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session.role !== 'ADMIN' && document.uploadedById !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { title, description, category, tags } = body

  const updated = await prisma.document.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(category !== undefined && { category }),
      ...(tags !== undefined && { tags }),
    },
    include: docInclude,
  })

  return NextResponse.json(updated)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { content } = await request.json()
  if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 })

  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      title: true,
      status: true,
      uploadedById: true,
      reviews: {
        where: { reviewerId: session.userId },
        select: { status: true },
      },
    },
  })

  const comment = await prisma.documentComment.create({
    data: { documentId: id, authorId: session.userId, content },
    include: { author: { select: { id: true, name: true, email: true, role: true } } },
  })

  // Notify doc owner (if commenter is not the owner)
  if (document && document.uploadedById !== session.userId) {
    // Check if commenter already completed their review (post-review comment)
    const completedStatuses = ['APPROVED', 'CHANGES_REQUESTED', 'REJECTED']
    const hasCompletedReview = document.reviews.some((r) => completedStatuses.includes(r.status))
    const docStillActive = ['IN_REVIEW', 'UPDATING', 'PENDING_APPROVAL', 'FINAL_DRAFT'].includes(document.status)
    const isPostReviewComment = hasCompletedReview && docStillActive

    createNotification(
      document.uploadedById,
      'COMMENT_ADDED',
      isPostReviewComment ? `Post-Review Comment: ${document.title}` : `New Comment: ${document.title}`,
      isPostReviewComment
        ? `${session.name} added a comment after completing their review of "${document.title}".`
        : `${session.name} commented on "${document.title}".`,
      id,
    )
  }

  prisma.documentActivity.create({
    data: { documentId: id, userId: session.userId, action: 'COMMENT_ADDED' },
  }).catch(() => {})

  return NextResponse.json(comment, { status: 201 })
}
