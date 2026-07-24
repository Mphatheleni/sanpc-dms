import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

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

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const category = searchParams.get('category') || ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}

  if (session.role !== 'ADMIN' && session.role !== 'DOCUMENT_MANAGER') {
    // Reviewers/approvers only see documents assigned to them
    where.reviews = { some: { reviewerId: session.userId } }
  }
  // ADMIN and DOCUMENT_MANAGER see all documents

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
    documentNumber, documentTypeCode, revision, originator, authorisedBy, purpose,
    originatorId, authorizerId,
  } = body

  // Calculate next review date from document type code per CSS/PR/CSF/005
  const reviewYears: Record<string, number> = {
    ST: 1, RM: 2, TOR: 2, GL: 3, BC: 3,
  }
  const yearsUntilReview = documentTypeCode ? (reviewYears[documentTypeCode] ?? 6) : 6
  const nextReviewDate = new Date()
  nextReviewDate.setFullYear(nextReviewDate.getFullYear() + yearsUntilReview)
  const nextReviewDateStr = nextReviewDate.toISOString().split('T')[0]

  if (!title || !storedName || !fileName) {
    const missing = [!title && 'title', !storedName && 'storedName', !fileName && 'fileName'].filter(Boolean)
    return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 })
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
      documentNumber: documentNumber ?? null,
      documentTypeCode: documentTypeCode ?? null,
      revision: revision ?? '00',
      originator: originator ?? null,
      authorisedBy: authorisedBy ?? null,
      purpose: purpose ?? null,
      originatorId: originatorId ?? null,
      authorizerId: authorizerId ?? null,
      status: 'REGISTERED' as never,
      nextReviewDate: nextReviewDateStr,
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
