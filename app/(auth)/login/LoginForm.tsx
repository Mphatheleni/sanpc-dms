'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

const DEMO_ACCOUNTS = [
  { label: 'Admin',               email: 'admin@sanpc.com',   role: 'ADMIN',            color: '#EF4444', bg: '#FEF2F2' },
  { label: 'Document Controller', email: 'manager@sanpc.com', role: 'DOCUMENT_MANAGER', color: '#1C3557', bg: '#E8EDF4' },
  { label: 'Reviewer 1',         email: 'alice@sanpc.com',   role: 'REVIEWER',         color: '#7C3AED', bg: '#F5F3FF' },
  { label: 'Reviewer 2',         email: 'bob@sanpc.com',     role: 'REVIEWER',         color: '#7C3AED', bg: '#F5F3FF' },
  { label: 'Approver 1',         email: 'ivy@sanpc.com',     role: 'APPROVER',         color: '#16A34A', bg: '#F0FDF4' },
  { label: 'Approver 2',         email: 'jack@sanpc.com',    role: 'APPROVER',         color: '#16A34A', bg: '#F0FDF4' },
]

export default function LoginForm({ entraError }: { entraError?: string }) {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  function prefill(acc: typeof DEMO_ACCOUNTS[0]) {
    setSelected(acc.email)
    setEmail(acc.email)
    setPassword('password')
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      })
      if (res.ok) {
        router.push('/dashboard')
      } else {
        const data = await res.json()
        setError(data.error || 'Invalid credentials')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  const displayError = error || entraError

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0f1e2e 0%, #1C3557 60%, #0f1e2e 100%)' }}
    >
      {/* Subtle dot grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background: 'rgba(255,255,255,0.97)' }}>

          {/* Top accent bar */}
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #F5A623 0%, #1C3557 100%)' }} />

          <div className="px-8 py-8">
            {/* Logo + brand */}
            <div className="flex items-center gap-3 mb-8">
              <div className="flex-shrink-0 rounded-xl p-2" style={{ backgroundColor: '#1C3557' }}>
                <Image
                  src="/logo.png"
                  alt="SANPC"
                  width={32}
                  height={32}
                  style={{ objectFit: 'contain' }}
                  priority
                  unoptimized
                />
              </div>
              <div>
                <p className="font-bold text-[17px] leading-none" style={{ color: '#1C3557' }}>SANPC DMS</p>
                <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mt-0.5" style={{ color: '#F5A623' }}>
                  Powering Your Tomorrow
                </p>
              </div>
            </div>

            <h1 className="text-2xl font-bold mb-1" style={{ color: '#111827' }}>Welcome back</h1>
            <p className="text-sm mb-6" style={{ color: '#6B7280' }}>Sign in to continue to your workspace.</p>

            {/* Microsoft SSO */}
            <a
              href="/api/auth/entra/login"
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:border-gray-300 hover:shadow transition-all duration-150 mb-5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 23 23">
                <rect x="1"  y="1"  width="10" height="10" fill="#f25022"/>
                <rect x="12" y="1"  width="10" height="10" fill="#7fba00"/>
                <rect x="1"  y="12" width="10" height="10" fill="#00a4ef"/>
                <rect x="12" y="12" width="10" height="10" fill="#ffb900"/>
              </svg>
              Continue with Microsoft
            </a>

            {/* Divider */}
            <div className="relative mb-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-gray-400 tracking-wide">or use a demo account</span>
              </div>
            </div>

            {/* Demo account quick-fill tiles */}
            <div className="grid grid-cols-2 gap-2 mb-5">
              {DEMO_ACCOUNTS.map((acc) => {
                const isSelected = selected === acc.email
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => prefill(acc)}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-all hover:shadow-sm"
                    style={{
                      borderColor: isSelected ? acc.color : `${acc.color}30`,
                      backgroundColor: isSelected ? acc.bg : 'white',
                      boxShadow: isSelected ? `0 0 0 1px ${acc.color}40` : undefined,
                    }}
                  >
                    <div
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: acc.color }}
                    >
                      {acc.label.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate leading-tight">{acc.label}</p>
                      <p className="text-[10px] text-gray-400 truncate leading-tight">{acc.email}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Error */}
            {displayError && (
              <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-100 bg-red-50 px-3.5 py-3">
                <svg className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700">{displayError}</p>
              </div>
            )}

            {/* Manual email/password form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100" />
                </div>
                <div className="relative flex justify-center mb-3">
                  <span className="bg-white px-3 text-xs text-gray-400 tracking-wide">or sign in manually</span>
                </div>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                placeholder="Email address"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-[#1C3557] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1C3557]/10"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="Password"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-[#1C3557] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1C3557]/10"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #1C3557 0%, #142840 100%)' }}
              >
                {loading && (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                )}
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

          </div>
        </div>

        <p className="text-center text-[11px] text-white/30 mt-5 tracking-widest uppercase">
          © 2026 SANPC · Document Management System
        </p>
      </div>
    </div>
  )
}
