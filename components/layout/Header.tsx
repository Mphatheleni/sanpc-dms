'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect, useCallback, useRef } from 'react'
import { LogOut, Bell, Search, CheckCircle, AlertTriangle, MessageSquare, Clock, FileCheck } from 'lucide-react'
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

type NotificationType = 'REVIEW_ASSIGNED' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' | 'REVIEW_COMPLETE' | 'COMMENT_ADDED'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  documentId: string | null
  read: boolean
  createdAt: string
}

function notificationIcon(type: string) {
  switch (type as NotificationType) {
    case 'REVIEW_ASSIGNED':  return <Clock className="h-4 w-4 text-blue-500 flex-shrink-0" />
    case 'APPROVED':         return <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
    case 'REJECTED':         return <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
    case 'CHANGES_REQUESTED':return <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
    case 'REVIEW_COMPLETE':  return <FileCheck className="h-4 w-4 text-purple-500 flex-shrink-0" />
    case 'COMMENT_ADDED':    return <MessageSquare className="h-4 w-4 text-gray-500 flex-shrink-0" />
    default:                 return <Bell className="h-4 w-4 text-gray-400 flex-shrink-0" />
  }
}

function timeAgo(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime()
  if (ms < 60000) return 'just now'
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`
  return `${Math.floor(ms / 86400000)}d ago`
}

function pageTitleFromPath(pathname: string): string {
  if (pathname === '/dashboard') return 'Dashboard'
  if (pathname === '/documents/new') return 'New Document'
  if (pathname.startsWith('/documents/') && pathname.includes('/')) return 'Document Detail'
  if (pathname === '/documents') return 'Documents'
  if (pathname === '/reports') return 'Reports & Analytics'
  if (pathname === '/admin') return 'User Management'
  return 'SANPC DMS'
}

export default function Header({ session }: { session: SessionUser }) {
  const router = useRouter()
  const pathname = usePathname()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [bellOpen, setBellOpen] = useState(false)
  const [search, setSearch] = useState('')
  const bellRef = useRef<HTMLDivElement>(null)

  const unread = notifications.filter((n) => !n.read).length

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) setNotifications(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close popover on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false)
      }
    }
    if (bellOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [bellOpen])

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'PATCH' })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
  }

  async function handleNotificationClick(n: Notification) {
    if (!n.read) await markRead(n.id)
    setBellOpen(false)
    if (n.documentId) router.push(`/documents/${n.documentId}`)
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (search.trim()) router.push(`/documents?search=${encodeURIComponent(search.trim())}`)
  }

  const roleStyle = roleColors[session.role] ?? { bg: '#F3F4F6', text: '#374151' }
  const initials = session.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm gap-4">
      {/* Left: page title */}
      <div className="hidden sm:block min-w-0">
        <h2 className="text-base font-semibold text-gray-800 truncate">{pageTitleFromPath(pathname)}</h2>
      </div>

      {/* Center: search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="w-full rounded-full border border-gray-200 bg-gray-50 pl-9 pr-4 py-1.5 text-sm text-gray-700 placeholder-gray-400 focus:border-gray-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>
      </form>

      {/* Right: bell + user */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => setBellOpen((prev) => !prev)}
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-800">Notifications</span>
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-xs font-medium text-blue-600 hover:underline">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">No notifications</div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0 ${!n.read ? 'bg-blue-50/50' : ''}`}
                    >
                      <div className="mt-0.5">{notificationIcon(n.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-tight truncate ${!n.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-snug">{n.message}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.read && <div className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-gray-200" />

        {/* Role badge */}
        <span
          className="hidden sm:inline-flex rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: roleStyle.bg, color: roleStyle.text }}
        >
          {roleLabels[session.role] ?? session.role}
        </span>

        {/* Avatar + name */}
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white flex-shrink-0"
            style={{ backgroundColor: '#1C3557' }}
          >
            {initials}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-semibold text-gray-800 leading-tight">{session.name}</p>
            <p className="text-xs text-gray-400 leading-tight">{session.email}</p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  )
}
