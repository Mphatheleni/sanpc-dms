'use client'

import Image from 'next/image'

export default function LoginForm({ entraError }: { entraError?: string }) {
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

            {/* Error */}
            {entraError && (
              <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-100 bg-red-50 px-3.5 py-3">
                <svg className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700">{entraError}</p>
              </div>
            )}

            {/* Microsoft SSO */}
            <a
              href="/api/auth/entra/login"
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:border-gray-300 hover:shadow transition-all duration-150"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 23 23">
                <rect x="1"  y="1"  width="10" height="10" fill="#f25022"/>
                <rect x="12" y="1"  width="10" height="10" fill="#7fba00"/>
                <rect x="1"  y="12" width="10" height="10" fill="#00a4ef"/>
                <rect x="12" y="12" width="10" height="10" fill="#ffb900"/>
              </svg>
              Continue with Microsoft
            </a>

          </div>
        </div>

        <p className="text-center text-[11px] text-white/30 mt-5 tracking-widest uppercase">
          © 2026 SANPC · Document Management System
        </p>
      </div>
    </div>
  )
}
