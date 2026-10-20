import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { Search, FileText, ArrowRight, Calendar, BookOpen, Clock, CheckCircle2 } from 'lucide-react'

const CATEGORY_ICONS: Record<string, string> = {
  'Policy': '📋',
  'Procedure': '🔧',
  'Work Practice': '⚙️',
  'Work Instruction': '📝',
  'Strategy & Planning': '🎯',
  'Risk Matrix': '⚠️',
  'Standard': '📐',
  'Guidelines': '📖',
  'Training Material': '🎓',
  'Test Script': '🧪',
  'Process Flow': '🔄',
  'Form / Template': '📄',
  'Corporate Governance': '🏛️',
  'Internal Specification': '⚗️',
  'Business Continuity Plan': '🔰',
  'Terms of Reference': '📃',
  'Management System Manual': '📚',
}

const IN_PROGRESS_STATUSES = [
  'IN_REVIEW', 'REVIEW_COMPLETE', 'FINAL_DRAFT',
  'PENDING_APPROVAL', 'PENDING_AUTHORIZATION', 'APPROVED',
] as const

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  IN_REVIEW:             { label: 'In Review',             bg: '#DBEAFE', color: '#1D4ED8' },
  REVIEW_COMPLETE:       { label: 'Review Complete',       bg: '#EDE9FE', color: '#6D28D9' },
  FINAL_DRAFT:           { label: 'Final Draft',           bg: '#FEF9C3', color: '#854D0E' },
  PENDING_APPROVAL:      { label: 'Pending Approval',      bg: '#FEF3C7', color: '#B45309' },
  PENDING_AUTHORIZATION: { label: 'Pending Authorization', bg: '#CCFBF1', color: '#0F766E' },
  APPROVED:              { label: 'Approved',              bg: '#DCFCE7', color: '#15803D' },
  CONTROLLED:            { label: 'Controlled',            bg: '#DCFCE7', color: '#15803D' },
}

function formatDate(dateStr: string | Date | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default async function PortalHomePage() {
  const session = await getSession()
  if (!session) redirect('/portal/login')

  const [totalControlled, inProgressCount, categoryGroups, recentDocs, inProgressDocs] = await Promise.all([
    prisma.document.count({ where: { status: 'CONTROLLED' } }),

    prisma.document.count({ where: { status: { in: [...IN_PROGRESS_STATUSES] } } }),

    prisma.document.groupBy({
      by: ['category'],
      where: { status: 'CONTROLLED' },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),

    prisma.document.findMany({
      where: { status: 'CONTROLLED' },
      orderBy: { controlledAt: 'desc' },
      take: 6,
      select: {
        id: true, title: true, category: true, documentNumber: true,
        revision: true, controlledAt: true,
      },
    }),

    prisma.document.findMany({
      where: { status: { in: [...IN_PROGRESS_STATUSES] } },
      orderBy: { updatedAt: 'desc' },
      take: 6,
      select: {
        id: true, title: true, category: true, documentNumber: true,
        revision: true, status: true, updatedAt: true,
      },
    }),
  ])

  const categoryCount = categoryGroups.filter((g) => g.category).length
  const topCategories = categoryGroups.filter((g) => g.category).slice(0, 8)

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-10">

      {/* Hero */}
      <div
        className="rounded-2xl overflow-hidden shadow-lg"
        style={{ background: 'linear-gradient(135deg, #0f1e2e 0%, #1C3557 60%, #243f62 100%)' }}
      >
        <div
          className="relative px-8 py-12 sm:py-16"
          style={{
            backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(245,166,35,0.08) 0%, transparent 60%)',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
          <div className="relative">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold mb-4"
              style={{ backgroundColor: 'rgba(245,166,35,0.15)', color: '#F5A623' }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#F5A623]" />
              Document Portal
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight">
              SANPC Document Library
            </h1>
            <p className="text-white/60 text-base mb-8 max-w-xl">
              Browse and download controlled SANPC documents — policies, procedures, standards, and more.
            </p>

            {/* Inline search */}
            <form action="/portal/documents" className="flex gap-3 max-w-xl">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                <input
                  name="search"
                  placeholder="Search by title, document number, or keyword…"
                  className="w-full rounded-xl border border-white/10 bg-white/10 pl-11 pr-4 py-3 text-sm text-white placeholder-white/40 focus:border-white/30 focus:bg-white/15 focus:outline-none transition-all"
                />
              </div>
              <button
                type="submit"
                className="flex-shrink-0 rounded-xl px-5 py-3 text-sm font-semibold transition-all hover:opacity-90"
                style={{ backgroundColor: '#F5A623', color: '#1C3557' }}
              >
                Search
              </button>
            </form>
          </div>
        </div>

        {/* Stats bar */}
        <div className="border-t border-white/10 px-8 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Controlled Documents', value: totalControlled.toLocaleString() },
            { label: 'Under Review / Approval', value: inProgressCount.toLocaleString() },
            { label: 'Document Categories', value: categoryCount.toLocaleString() },
            { label: 'Document Types', value: topCategories.length.toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label} className="text-center py-1">
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-white/50 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Browse by Category */}
      {topCategories.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Browse by Category</h2>
              <p className="text-sm text-gray-500">Filter controlled documents by type</p>
            </div>
            <Link
              href="/portal/documents"
              className="flex items-center gap-1.5 text-sm font-medium hover:underline"
              style={{ color: '#1C3557' }}
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {topCategories.map((cat) => (
              <Link
                key={cat.category}
                href={`/portal/documents?type=${encodeURIComponent(cat.category!)}`}
                className="group flex flex-col items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:border-[#1C3557]/30 hover:shadow-md transition-all"
              >
                <span className="text-3xl">{CATEGORY_ICONS[cat.category!] ?? '📄'}</span>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-800 leading-tight group-hover:text-[#1C3557] transition-colors">
                    {cat.category}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {cat._count.id} doc{cat._count.id !== 1 ? 's' : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Currently Under Review */}
      {inProgressDocs.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Currently Under Review</h2>
              <p className="text-sm text-gray-500">Documents progressing through the review and approval workflow</p>
            </div>
            <Link
              href="/portal/documents?view=review"
              className="flex items-center gap-1.5 text-sm font-medium hover:underline"
              style={{ color: '#1C3557' }}
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {inProgressDocs.map((doc) => {
              const cfg = STATUS_CONFIG[doc.status] ?? { label: doc.status, bg: '#F3F4F6', color: '#374151' }
              return (
                <Link
                  key={doc.id}
                  href={`/portal/documents/${doc.id}`}
                  className="group flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:border-[#1C3557]/30 hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: cfg.bg }}
                    >
                      <Clock className="h-5 w-5" style={{ color: cfg.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2 group-hover:text-[#1C3557] transition-colors">
                        {doc.title}
                      </p>
                      {doc.documentNumber && (
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">{doc.documentNumber}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                      style={{ backgroundColor: cfg.bg, color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                    {doc.category && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 truncate max-w-28">
                        {doc.category}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Recently Published */}
      {recentDocs.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Recently Published</h2>
              <p className="text-sm text-gray-500">Latest controlled documents available for download</p>
            </div>
            <Link
              href="/portal/documents"
              className="flex items-center gap-1.5 text-sm font-medium hover:underline"
              style={{ color: '#1C3557' }}
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentDocs.map((doc) => (
              <Link
                key={doc.id}
                href={`/portal/documents/${doc.id}`}
                className="group flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:border-[#1C3557]/30 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: '#E8EDF4' }}
                  >
                    <CheckCircle2 className="h-5 w-5" style={{ color: '#15803D' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2 group-hover:text-[#1C3557] transition-colors">
                      {doc.title}
                    </p>
                    {doc.documentNumber && (
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">{doc.documentNumber}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-50">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(doc.controlledAt)}
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.category && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                        {doc.category}
                      </span>
                    )}
                    {doc.revision && (
                      <span className="font-mono text-[10px]">Rev {doc.revision}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {totalControlled === 0 && inProgressCount === 0 && (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-16 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Documents Yet</h3>
          <p className="text-sm text-gray-400">
            Documents will appear here once they are submitted for review or published.
          </p>
        </div>
      )}
    </div>
  )
}
