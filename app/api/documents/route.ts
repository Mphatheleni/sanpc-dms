import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

const docInclude = {
  uploadedBy: { select: { id: true, name: true, email: true, role: true } },
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

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const category = searchParams.get('category') || ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}

  if (session.role === 'DOCUMENT_MANAGER') {
    where.uploadedById = session.userId
  } else if (session.role === 'REVIEWER') {
    where.reviews = { some: { reviewerId: session.userId, isApprover: false } }
  } else if (session.role === 'APPROVER') {
    where.reviews = { some: { reviewerId: session.userId, isApprover: true } }
  }
  // ADMIN sees all

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
    ]
  }
  if (status) where.status = status
  if (category) where.category = category

  const documents = await prisma.document.findMany({
    where,
    include: docInclude,
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(documents)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.role !== 'DOCUMENT_MANAGER' && session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const {
    title, description, category, tags,
    storedName, fileName, fileType, fileSize,
    sharePointUrl, sharePointItemId, reviewDeadlineDays,
    reviewers, approvers, metadata,
  } = body

  if (!title || !storedName || !fileName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Build all review records: reviewers first (isApprover=false), then approvers (isApprover=true)
  const reviewRecords = [
    ...(reviewers ?? []).map((r: { userId: string; order: number }) => ({
      reviewerId: r.userId,
      order: r.order,
      isApprover: false,
      status: 'PENDING' as const,
    })),
    ...(approvers ?? []).map((a: { userId: string; order: number }) => ({
      reviewerId: a.userId,
      order: a.order,
      isApprover: true,
      status: 'PENDING' as const,
    })),
  ]

  const document = await prisma.document.create({
    data: {
      title,
      description,
      category,
      tags,
      fileUrl: storedName,
      fileName,
      fileType,
      fileSize,
      sharePointUrl: sharePointUrl ?? null,
      sharePointItemId: sharePointItemId ?? null,
      reviewDeadlineDays: reviewDeadlineDays ? Number(reviewDeadlineDays) : null,
      uploadedById: session.userId,
      metadata: metadata?.length
        ? { create: metadata.map((m: { key: string; value: string }) => ({ key: m.key, value: m.value })) }
        : undefined,
      reviews: reviewRecords.length
        ? { create: reviewRecords }
        : undefined,
    },
    include: docInclude,
  })

  prisma.documentActivity.create({
    data: { documentId: document.id, userId: session.userId, action: 'CREATED' },
  }).catch(() => {})

  return NextResponse.json(document, { status: 201 })
}
