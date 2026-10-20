import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { Toaster } from '@/components/ui/sonner'
import PortalHeader from '@/components/portal/PortalHeader'

export default async function PortalProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/portal/login')

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f4f6f9' }}>
      <PortalHeader name={session.name} email={session.email} />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-gray-200 bg-white py-4 px-6">
        <p className="text-center text-xs text-gray-400">
          © 2026 SANPC · Document Management System · All documents are controlled and subject to revision
        </p>
      </footer>
      <Toaster position="top-right" />
    </div>
  )
}
