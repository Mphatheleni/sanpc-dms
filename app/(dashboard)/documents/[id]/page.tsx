import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import DocumentDetail from './DocumentDetail'
import type { Document, SessionUser } from '@/types'

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params

  const document = await prisma.document.findUnique({
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
      versions: {
        include: { uploadedBy: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { versionNumber: 'asc' },
      },
      activities: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  })

  if (!document) notFound()

  const sessionUser: SessionUser = {
    userId: session.userId,
    email: session.email,
    role: session.role as SessionUser['role'],
    name: session.name,
  }

  // Fetch users for reviewer replacement (admins/managers can replace reviewers mid-review)
  const users = await prisma.user.findMany({
    where: { role: { in: ['REVIEWER', 'APPROVER', 'ADMIN', 'DOCUMENT_MANAGER'] } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  })

  return (
    <DocumentDetail
      initialDoc={document as unknown as Document}
      session={sessionUser}
      users={users as { id: string; name: string; email: string; role: string }[]}
    />
  )
}
