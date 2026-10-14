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

  if (session.role === 'ORIGINATOR') {
    // ORIGINATOR sees only documents they originated
    where.originatorId = session.userId
  } else if (session.role !== 'ADMIN' && session.role !== 'DOCUMENT_MANAGER') {
    // Reviewers/approvers see documents assigned to them OR where they are the originator
    where.AND = [
      {
        OR: [
          { reviews: { some: { reviewerId: session.userId } } },
          { originatorId: session.userId },
        ],
      },
    ]
  }
  // ADMIN and DOCUMENT_MANAGER see all documents

  // W2: hide SUPERSEDED from everyone except Document Controllers and ADMIN
  if (session.role !== 'DOCUMENT_MANAGER' && session.role !== 'ADMIN') {
    where.NOT = { status: 'SUPERSEDED' }
  }

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
    originatorId, originatorEmail, originatorName,
    authorizerId, authorizerEmail, authorizerName,
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

  // Resolve a member to a DB user id — auto-provisions AD-only users on first use
  async function resolveId(m: { userId?: string; email?: string; name?: string }): Promise<string> {
    // userId is a real DB id when it doesn't look like an email
    if (m.userId && !m.userId.includes('@')) return m.userId
    const email = (m.email || m.userId || '').toLowerCase().trim()
    if (!email) throw new Error('Reviewer/approver has no userId or email')
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { name: m.name ?? email, email, role: 'REVIEWER', password: '' },
    })
    return user.id
  }

  // Auto-provision AD-only originator/authorizer so the document has a linked user record
  let resolvedOriginatorId: string | null = originatorId ?? null
  if (!resolvedOriginatorId && originatorEmail) {
    const u = await prisma.user.upsert({
      where: { email: originatorEmail.toLowerCase().trim() },
      update: {},
      create: { name: originatorName ?? originatorEmail, email: originatorEmail.toLowerCase().trim(), role: 'ORIGINATOR', password: '' },
    })
    resolvedOriginatorId = u.id
  }

  let resolvedAuthorizerId: string | null = authorizerId ?? null
  if (!resolvedAuthorizerId && authorizerEmail) {
    const u = await prisma.user.upsert({
      where: { email: authorizerEmail.toLowerCase().trim() },
      update: {},
      create: { name: authorizerName ?? authorizerEmail, email: authorizerEmail.toLowerCase().trim(), role: 'APPROVER', password: '' },
    })
    resolvedAuthorizerId = u.id
  }

  // Build all review records: reviewers first (isApprover=false), then approvers (isApprover=true)
  const reviewerList: { userId: string; email?: string; name?: string; order: number }[] = reviewers ?? []
  const approverList: { userId: string; email?: string; name?: string; order: number }[] = approvers ?? []

  const reviewRecords = [
    ...await Promise.all(reviewerList.map(async (r) => ({
      reviewerId: await resolveId(r),
      order: r.order,
      isApprover: false,
      status: 'PENDING' as const,
    }))),
    ...await Promise.all(approverList.map(async (a) => ({
      reviewerId: await resolveId(a),
      order: a.order,
      isApprover: true,
      status: 'PENDING' as const,
    }))),
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
      originatorId: resolvedOriginatorId,
      authorizerId: resolvedAuthorizerId,
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
