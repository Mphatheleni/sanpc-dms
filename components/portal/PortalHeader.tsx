'use client'

import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { LogOut, FileText, Home, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface PortalHeaderProps {
  name: string
  email: string
}

export default function PortalHeader({ name, email }: PortalHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/portal/login')
  }

  const navLinks = [
    { href: '/portal', label: 'Home', icon: Home },
    { href: '/portal/documents', label: 'Document Library', icon: FileText },
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/portal" className="flex items-center gap-3 flex-shrink-0">
            <div className="flex-shrink-0 rounded-lg p-1.5" style={{ backgroundColor: '#1C3557' }}>
              <Image src="/logo.png" alt="SANPC" width={24} height={24} style={{ objectFit: 'contain' }} unoptimized />
            </div>
            <div className="hidden sm:block">
              <p className="font-bold text-[14px] leading-none" style={{ color: '#1C3557' }}>SANPC</p>
              <p className="text-[9px] font-semibold tracking-[0.15em] uppercase mt-0.5" style={{ color: '#F5A623' }}>
                Document Portal
              </p>
            </div>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== '/portal' && pathname.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  style={active ? { backgroundColor: '#1C3557' } : {}}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* User */}
          <div className="flex items-center gap-3">
            {/* Mobile nav */}
            <div className="flex md:hidden items-center gap-1">
              {navLinks.map(({ href, icon: Icon }) => {
                const active = pathname === href || (href !== '/portal' && pathname.startsWith(href))
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                      active ? 'text-white' : 'text-gray-500 hover:bg-gray-100'
                    }`}
                    style={active ? { backgroundColor: '#1C3557' } : {}}
                  >
                    <Icon className="h-5 w-5" />
                  </Link>
                )
              })}
            </div>

            <div className="h-6 w-px bg-gray-200 hidden sm:block" />

            {/* Profile dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen((p) => !p)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 transition-colors"
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: '#1C3557' }}
                >
                  {initials}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-gray-800 leading-tight truncate max-w-32">{name}</p>
                  <p className="text-xs text-gray-400 leading-tight">Portal User</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-gray-400 hidden sm:block" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-gray-200 bg-white shadow-xl z-50 overflow-hidden">
                  <div
                    className="px-4 py-4 border-b border-gray-100"
                    style={{ background: 'linear-gradient(135deg, #1C3557 0%, #142840 100%)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white border-2 border-white/20" style={{ backgroundColor: '#1C3557' }}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{name}</p>
                        <p className="text-xs text-white/60 truncate mt-0.5">{email}</p>
                        <span className="inline-flex mt-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800">
                          Portal User
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => { setProfileOpen(false); logout() }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
