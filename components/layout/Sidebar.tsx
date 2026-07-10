'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  FileText,
  FilePlus,
  Users,
  BarChart2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import type { SessionUser } from '@/types'

const navItems = [
  { href: '/dashboard',      label: 'Dashboard',    icon: LayoutDashboard, roles: ['ADMIN', 'DOCUMENT_MANAGER', 'REVIEWER', 'APPROVER'] },
  { href: '/documents',      label: 'Documents',    icon: FileText,        roles: ['ADMIN', 'DOCUMENT_MANAGER', 'REVIEWER', 'APPROVER'] },
  { href: '/documents/new',  label: 'New Document', icon: FilePlus,        roles: ['ADMIN', 'DOCUMENT_MANAGER'] },
  { href: '/reports',        label: 'Reports',      icon: BarChart2,       roles: ['ADMIN', 'DOCUMENT_MANAGER'] },
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

function NavItems({
  items,
  pathname,
  collapsed,
}: {
  items: typeof navItems
  pathname: string
  collapsed: boolean
}) {
  // Pick the single most-specific matching item so only one is ever highlighted
  const activeHref = items
    .filter(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  return (
    <>
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === activeHref
        return (
          <Link
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 relative"
            style={
              active
                ? { backgroundColor: 'rgba(245,166,35,0.15)', color: '#F5A623' }
                : { color: 'rgba(255,255,255,0.5)' }
            }
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)'
                ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.9)'
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.backgroundColor = ''
                ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'
              }
            }}
          >
            {active && (
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                style={{ backgroundColor: '#F5A623' }}
              />
            )}
            <Icon className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </Link>
        )
      })}
    </>
  )
}

export default function Sidebar({ session }: { session: SessionUser }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored !== null) setCollapsed(stored === 'true')
  }, [])

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  const visible = navItems.filter((item) => item.roles.includes(session.role))

  return (
    <aside
      className="flex h-full flex-col flex-shrink-0 transition-all duration-200"
      style={{
        width: collapsed ? 64 : 256,
        background: 'linear-gradient(180deg, #1C3557 0%, #142840 100%)',
      }}
    >
      {/* Logo / brand */}
      <div
        className="flex h-16 items-center gap-3 px-4 overflow-hidden"
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
        {!collapsed && (
          <div className="leading-none min-w-0">
            <p className="text-[15px] font-bold text-white tracking-wide truncate">SANPC DMS</p>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">Document Portal</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-hidden">
        <NavItems items={visible} pathname={pathname} collapsed={collapsed} />
      </nav>

      {/* User card */}
      {!collapsed && (
        <div className="mx-2 mb-2 rounded-xl p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
              style={{ backgroundColor: roleColors[session.role] ?? '#1C3557', opacity: 0.9 }}
            >
              {session.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-white/90 truncate leading-tight">{session.name}</p>
              <p className="text-[10px] text-white/35 truncate mt-0.5">{roleLabels[session.role] ?? session.role}</p>
            </div>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <div className="px-2 pb-4">
        <button
          onClick={toggleCollapse}
          className="flex w-full items-center justify-center rounded-lg py-2 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Tagline */}
      {!collapsed && (
        <div className="pb-3 text-center">
          <p className="text-[9px] text-white/15 uppercase tracking-[0.22em] font-medium">Powering Your Tomorrow</p>
        </div>
      )}
    </aside>
  )
}
