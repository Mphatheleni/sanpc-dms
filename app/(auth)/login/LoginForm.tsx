'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { CheckCircle, FileText, GitBranch, Shield } from 'lucide-react'
import { Input } from '@/components/ui/Input'

interface DemoUser {
  email: string
  name: string
  role: string
}

const roleColors: Record<string, string> = {
  ADMIN:            '#EF4444',
  DOCUMENT_MANAGER: '#1C3557',
  REVIEWER:         '#7C3AED',
  APPROVER:         '#16A34A',
}

const roleLabels: Record<string, string> = {
  ADMIN:            'Admin',
  DOCUMENT_MANAGER: 'Manager',
  REVIEWER:         'Reviewer',
  APPROVER:         'Approver',
}

const features = [
  { icon: FileText,    text: 'Secure document management' },
  { icon: GitBranch,  text: 'Multi-stage review workflows' },
  { icon: Shield,     text: 'Full audit trail & SLA tracking' },
  { icon: CheckCircle,text: 'Version history & inline preview' },
]

export default function LoginForm({ demoUsers }: { demoUsers: DemoUser[] }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (res.ok) {
        router.push('/dashboard')
      } else {
        const data = await res.json()
        setError(data.error || 'Login failed')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  // Group users by role for display
  const grouped: Record<string, DemoUser[]> = {}
  for (const u of demoUsers) {
    if (!grouped[u.role]) grouped[u.role] = []
    grouped[u.role].push(u)
  }
  const roleOrder = ['ADMIN', 'DOCUMENT_MANAGER', 'REVIEWER', 'APPROVER']

  return (
    <div className="h-screen flex overflow-hidden">

      {/* ── Left brand panel ─────────────────────────────────────── */}
      <div
        className="hidden lg:flex w-5/12 flex-col items-center justify-center relative overflow-hidden flex-shrink-0"
        style={{ background: 'linear-gradient(160deg, #1C3557 0%, #0d1f33 100%)' }}
      >
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #F5A623, transparent)' }} />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #F5A623, transparent)' }} />

        <div className="relative z-10 flex flex-col items-center px-12 text-center">
          <Image src="/logo.png" alt="SANPC" width={140} height={140} style={{ objectFit: 'contain' }} priority unoptimized />
          <h1 className="mt-6 text-3xl font-bold text-white tracking-tight">SANPC DMS</h1>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.2em]" style={{ color: '#F5A623' }}>
            Powering Your Tomorrow
          </p>
          <div className="mt-10 w-full space-y-4 text-left">
            {features.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'rgba(245,166,35,0.15)' }}>
                  <Icon className="h-4 w-4" style={{ color: '#F5A623' }} />
                </div>
                <span className="text-sm text-white/75">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="flex flex-col items-center px-6 py-10 min-h-full justify-center">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-6 lg:hidden">
            <Image src="/logo.png" alt="SANPC" width={72} height={72} style={{ objectFit: 'contain' }} priority unoptimized />
            <p className="mt-2 text-xs font-semibold uppercase tracking-widest" style={{ color: '#F5A623' }}>
              Powering Your Tomorrow
            </p>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold" style={{ color: '#1C3557' }}>Welcome back</h2>
            <p className="mt-1 text-sm text-gray-500">Sign in to your SANPC account.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              placeholder="you@sanpc.com"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 border border-red-200">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg py-2.5 text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ backgroundColor: '#F5A623', color: '#1C3557' }}
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

          {/* Demo accounts grouped by role */}
          <div className="mt-6">
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-gray-50 px-3 text-xs text-gray-400 uppercase tracking-wide">
                  Demo accounts · password: <span className="font-mono font-semibold">password</span>
                </span>
              </div>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-3 pr-1">
              {roleOrder.filter((r) => grouped[r]).map((role) => (
                <div key={role}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 sticky top-0 bg-gray-50 py-0.5"
                    style={{ color: roleColors[role] }}>
                    {roleLabels[role]}
                  </p>
                  <div className="space-y-1">
                    {grouped[role].map((u) => (
                      <button
                        key={u.email}
                        type="button"
                        onClick={() => { setEmail(u.email); setPassword('password') }}
                        className="w-full flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-1.5 hover:border-gray-300 hover:shadow-sm transition-all text-left"
                      >
                        <span className="text-gray-700 font-medium truncate text-xs">{u.name}</span>
                        <span className="text-[10px] text-gray-400 ml-2 flex-shrink-0">{u.email}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
        </div>
      </div>
    </div>
  )
}
