import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import UserManagement from './UserManagement'
import MandatoryReviewersConfig from '@/components/admin/MandatoryReviewersConfig'

export default async function AdminPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'ADMIN') redirect('/dashboard')

  const [users, docCounts, mandatoryConfigs] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, email: true, role: true, departmentRole: true, createdAt: true },
    }),
    prisma.document.groupBy({
      by: ['uploadedById'],
      _count: { id: true },
    }),
    prisma.mandatoryReviewerConfig.findMany({
      orderBy: [{ documentType: 'asc' }, { createdAt: 'asc' }],
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    }),
  ])

  const countMap = Object.fromEntries(docCounts.map((d) => [d.uploadedById, d._count.id]))
  const usersWithCounts = users.map((u) => ({ ...u, docCount: countMap[u.id] ?? 0 }))

  return (
    <div className="space-y-10">
      <UserManagement initialUsers={usersWithCounts} currentUserId={session.userId} />
      <hr className="border-gray-200" />
      <MandatoryReviewersConfig initialConfigs={mandatoryConfigs} users={users} />
    </div>
  )
}
