'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  FilePlus,
  Users,
} from 'lucide-react'
import type { SessionUser } from '@/types'

const navItems = [
  { href: '/dashboard',      label: 'Dashboard',    icon: LayoutDashboard, roles: ['ADMIN', 'DOCUMENT_MANAGER', 'REVIEWER', 'APPROVER'] },
  { href: '/documents',      label: 'Documents',    icon: FileText,        roles: ['ADMIN', 'DOCUMENT_MANAGER', 'REVIEWER', 'APPROVER'] },
  { href: '/documents/new',  label: 'New Document', icon: FilePlus,        roles: ['ADMIN', 'DOCUMENT_MANAGER'] },
  { href: '/admin',          label: 'Users',        icon: Users,           roles: ['ADMIN'] },
]

const roleLabels: Record<string, string> = {
  ADMIN:             'Admin',
  DOCUMENT_MANAGER:  'Manager',
  REVIEWER:          'Reviewer',
  APPROVER:          'Approver',
}

const roleColors: Record<string, string> = {
  ADMIN:            '#EF4444',
  DOCUMENT_MANAGER: '#1C3557',
  REVIEWER:         '#7C3AED',
  APPROVER:         '#16A34A',
}

export default function Sidebar({ session }: { session: SessionUser }) {
  const pathname = usePathname()

  const visible = navItems.filter((item) =>
    item.roles.includes(session.role)
  )

  return (
    <aside
      className="flex h-full w-64 flex-col"
      style={{ background: 'linear-gradient(180deg, #1C3557 0%, #142840 100%)' }}
    >
      {/* Logo / brand */}
      <div
        className="flex h-16 items-center gap-3 px-5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex-shrink-0">
          <Image
            src="/logo.png"
            alt="SANPC"
            width={34}
            height={34}
            style={{ objectFit: 'contain' }}
            unoptimized
          />
        </div>
        <div className="leading-none">
          <p className="text-[15px] font-bold text-white tracking-wide">SANPC DMS</p>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">Document Portal</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">
          Navigation
        </p>
        {visible.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`))
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all relative"
              style={
                active
                  ? { backgroundColor: '#F5A623', color: '#1C3557' }
                  : { color: 'rgba(255,255,255,0.65)' }
              }
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.08)'
                  ;(e.currentTarget as HTMLElement).style.color = 'white'
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = ''
                  ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)'
                }
              }}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{label}</span>
              {active && (
                <div
                  className="ml-auto h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: '#1C3557' }}
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* User card at bottom */}
      <div
        className="mx-3 mb-4 rounded-xl p-3"
        style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: roleColors[session.role] ?? '#1C3557' }}
          >
            {session.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate leading-tight">{session.name}</p>
            <p className="text-[10px] text-white/40 truncate">{roleLabels[session.role] ?? session.role}</p>
          </div>
        </div>
      </div>

      {/* Tagline */}
      <div
        className="pb-4 text-center"
      >
        <p className="text-[9px] text-white/20 uppercase tracking-[0.2em]">Powering Your Tomorrow</p>
      </div>
    </aside>
  )
}
