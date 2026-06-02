import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import type { SessionUser } from '@/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const sessionUser: SessionUser = {
    userId: session.userId,
    email: session.email,
    role: session.role as SessionUser['role'],
    name: session.name,
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#f4f6f9' }}>
      <Sidebar session={sessionUser} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header session={sessionUser} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
