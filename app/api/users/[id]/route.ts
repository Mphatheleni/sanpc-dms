import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createNotification } from '@/lib/notify'
import { sendRoleChangedEmail } from '@/lib/email'
import { emitToUser } from '@/lib/realtime'

const ROLE_LABELS: Record<string, string> = {
  ADMIN:            'Administrator',
  DOCUMENT_MANAGER: 'Document Controller',
  REVIEWER:         'Reviewer',
  APPROVER:         'Approver',
  AUTHORIZER:       'Authorizer',
  ORIGINATOR:       'Originator',
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { role } = await request.json()

  const validRoles = ['ADMIN', 'DOCUMENT_MANAGER', 'REVIEWER', 'APPROVER', 'AUTHORIZER', 'ORIGINATOR']
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })

  const roleLabel = ROLE_LABELS[role] ?? role

  // In-app notification (persisted — visible on next poll if SSE is unavailable)
  createNotification(
    id,
    'ROLE_CHANGED',
    'Your role has been updated',
    `Your account role has been updated to ${roleLabel}.`,
  )

  // Real-time push — the client receives this instantly, shows a toast, and calls router.refresh()
  emitToUser(id, { type: 'ROLE_CHANGED', role, label: roleLabel })

  // Email notification — fire-and-forget; never fail the API response
  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  sendRoleChangedEmail({
    toEmail: user.email,
    toName: user.name,
    newRole: role,
    newRoleLabel: roleLabel,
    appUrl,
  }).catch((e) => console.error('[users] role-change email error:', e))

  return NextResponse.json(user)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  if (id === session.userId) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
  }

  await prisma.user.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
