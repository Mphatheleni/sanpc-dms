import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import UserManagement from './UserManagement'

export default async function AdminPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'ADMIN') redirect('/dashboard')

  const users = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })

  const docCounts = await prisma.document.groupBy({
    by: ['uploadedById'],
    _count: { id: true },
  })
  const countMap = Object.fromEntries(docCounts.map((d) => [d.uploadedById, d._count.id]))

  const usersWithCounts = users.map((u) => ({ ...u, docCount: countMap[u.id] ?? 0 }))

  return <UserManagement initialUsers={usersWithCounts} currentUserId={session.userId} />
}
