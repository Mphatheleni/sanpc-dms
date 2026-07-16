import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

const USER_SELECT = { id: true, name: true, email: true, role: true } as const

/**
 * GET /api/mandatory-reviewers?type=Policy
 * Returns the mandatory reviewers configured for this document type.
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const type = request.nextUrl.searchParams.get('type')
  if (!type) return NextResponse.json({ error: 'type param required' }, { status: 400 })

  const configs = await prisma.mandatoryReviewerConfig.findMany({
    where: { documentType: type },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: USER_SELECT } },
  })

  return NextResponse.json(configs)
}

/**
 * POST /api/mandatory-reviewers
 * Body: { documentType, userId }
 * Adds a mandatory reviewer to a document type.
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { documentType, userId } = await request.json()
  if (!documentType || !userId) {
    return NextResponse.json({ error: 'documentType and userId required' }, { status: 400 })
  }

  try {
    const config = await prisma.mandatoryReviewerConfig.create({
      data: { documentType, userId },
      include: { user: { select: USER_SELECT } },
    })
    return NextResponse.json(config, { status: 201 })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Already configured' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
