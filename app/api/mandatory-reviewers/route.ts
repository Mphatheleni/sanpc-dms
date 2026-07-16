import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const DEPT_ROLES = [
  { role: 'LEGAL',          label: 'Legal' },
  { role: 'INTERNAL_AUDIT', label: 'Internal Audit' },
  { role: 'QUALITY',        label: 'Quality' },
  { role: 'PROCEDURES',     label: 'Procedures Section' },
] as const

/**
 * GET /api/mandatory-reviewers?type=Policy
 * Returns the mandatory functions configured for this doc type,
 * each with the currently-assigned person (or null if unassigned).
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const type = request.nextUrl.searchParams.get('type')
  if (!type) return NextResponse.json({ error: 'type param required' }, { status: 400 })

  const configs = await prisma.mandatoryFunctionConfig.findMany({
    where: { documentType: type },
    orderBy: { createdAt: 'asc' },
  })

  // Resolve each deptRole to the current user who holds it
  const users = await prisma.user.findMany({
    where: { departmentRole: { in: configs.map((c) => c.deptRole) } },
    select: { id: true, name: true, email: true, role: true, departmentRole: true },
  })

  const userByRole = Object.fromEntries(users.map((u) => [u.departmentRole!, u]))

  const result = configs.map((c) => ({
    id: c.id,
    documentType: c.documentType,
    deptRole: c.deptRole,
    deptLabel: DEPT_ROLES.find((d) => d.role === c.deptRole)?.label ?? c.deptRole,
    user: userByRole[c.deptRole] ?? null,
  }))

  return NextResponse.json(result)
}

/**
 * POST /api/mandatory-reviewers
 * Body: { documentType, deptRole }
 * Adds a function requirement for a document type.
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { documentType, deptRole } = await request.json()
  if (!documentType || !deptRole) {
    return NextResponse.json({ error: 'documentType and deptRole required' }, { status: 400 })
  }

  try {
    const config = await prisma.mandatoryFunctionConfig.create({
      data: { documentType, deptRole },
    })

    // Resolve the user for the response
    const user = await prisma.user.findFirst({
      where: { departmentRole: deptRole },
      select: { id: true, name: true, email: true, role: true, departmentRole: true },
    })

    return NextResponse.json({
      ...config,
      deptLabel: DEPT_ROLES.find((d) => d.role === deptRole)?.label ?? deptRole,
      user: user ?? null,
    }, { status: 201 })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Already configured' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
