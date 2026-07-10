import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyReviewToken } from '@/lib/reviewToken'

// GET — list all comments for this document (token-gated)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const payload = await verifyReviewToken(token)
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

  const comments = await prisma.documentComment.findMany({
    where: { documentId: payload.documentId },
    include: { author: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(comments)
}

// POST — add a comment attributed to the reviewer identified by token
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const payload = await verifyReviewToken(token)
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 })

  const comment = await prisma.documentComment.create({
    data: {
      documentId: payload.documentId,
      authorId: payload.reviewerId,
      content: content.trim(),
    },
    include: { author: { select: { id: true, name: true, email: true, role: true } } },
  })

  await prisma.documentActivity.create({
    data: {
      documentId: payload.documentId,
      userId: payload.reviewerId,
      action: 'COMMENT_ADDED',
    },
  }).catch(() => {})

  return NextResponse.json(comment)
}
