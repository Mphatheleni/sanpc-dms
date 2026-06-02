'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import type { SessionUser } from '@/types'

const roleLabels: Record<string, string> = {
  ADMIN:            'Admin',
  DOCUMENT_MANAGER: 'Manager',
  REVIEWER:         'Reviewer',
  APPROVER:         'Approver',
}

const roleColors: Record<string, { bg: string; text: string }> = {
  ADMIN:            { bg: '#FEE2E2', text: '#991B1B' },
  DOCUMENT_MANAGER: { bg: '#E8EDF4', text: '#1C3557' },
  REVIEWER:         { bg: '#EDE9FE', text: '#5B21B6' },
  APPROVER:         { bg: '#DCFCE7', text: '#166534' },
}

export default function Header({ session }: { session: SessionUser }) {
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const roleStyle = roleColors[session.role] ?? { bg: '#F3F4F6', text: '#374151' }
  const initials = session.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm">
      {/* Left: breadcrumb or empty */}
      <div />

      {/* Right: user info + logout */}
      <div className="flex items-center gap-3">
        {/* Role badge */}
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: roleStyle.bg, color: roleStyle.text }}
        >
          {roleLabels[session.role] ?? session.role}
        </span>

        {/* User info */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white flex-shrink-0"
            style={{ backgroundColor: '#1C3557' }}
          >
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-gray-800 leading-tight">{session.name}</p>
            <p className="text-xs text-gray-400 leading-tight">{session.email}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-gray-200" />

        {/* Logout */}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  )
}
