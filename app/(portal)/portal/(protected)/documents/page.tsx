import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import {
  Search, FileText, Download, Calendar, ArrowUpDown,
  ChevronLeft, ChevronRight, X, Clock, CheckCircle2, SlidersHorizontal,
} from 'lucide-react'

interface PageProps {
  searchParams: Promise<{
    search?: string
    type?: string
    sort?: string
    page?: string
    view?: string
  }>
}

const PAGE_SIZE = 24

const DOCUMENT_TYPES = [
  'Policy', 'Procedure', 'Work Practice', 'Work Instruction',
  'Strategy & Planning', 'Risk Matrix', 'Standard', 'Guidelines',
  'Training Material', 'Test Script', 'Process Flow', 'Form / Template',
  'Corporate Governance', 'Internal Specification', 'Business Continuity Plan',
  'Terms of Reference', 'Management System Manual',
]

const SORT_OPTIONS = [
  { value: 'date',       label: 'Newest First' },
  { value: 'date_asc',   label: 'Oldest First' },
  { value: 'title',      label: 'Title A–Z' },
  { value: 'title_desc', label: 'Title Z–A' },
  { value: 'number',     label: 'Document Number' },
]

// Statuses visible in the portal
const CONTROLLED_STATUS = ['CONTROLLED']
const REVIEW_STATUSES   = [
  'IN_REVIEW', 'REVIEW_COMPLETE', 'FINAL_DRAFT',
  'PENDING_APPROVAL', 'PENDING_AUTHORIZATION', 'APPROVED',
]
const ALL_PORTAL_STATUSES = [...CONTROLLED_STATUS, ...REVIEW_STATUSES]

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  CONTROLLED:            { label: 'Controlled',            bg: '#DCFCE7', color: '#15803D' },
  APPROVED:              { label: 'Approved',              bg: '#DCFCE7', color: '#15803D' },
  IN_REVIEW:             { label: 'In Review',             bg: '#DBEAFE', color: '#1D4ED8' },
  REVIEW_COMPLETE:       { label: 'Review Complete',       bg: '#EDE9FE', color: '#6D28D9' },
  FINAL_DRAFT:           { label: 'Final Draft',           bg: '#FEF9C3', color: '#854D0E' },
  PENDING_APPROVAL:      { label: 'Pending Approval',      bg: '#FEF3C7', color: '#B45309' },
  PENDING_AUTHORIZATION: { label: 'Pending Authorization', bg: '#CCFBF1', color: '#0F766E' },
}

function formatDate(dateStr: string | Date | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export default async function PortalDocumentsPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/portal/login')

  const { search = '', type = '', sort = 'date', page = '1', view = 'all' } = await searchParams
  const pageNum = Math.max(1, parseInt(page, 10) || 1)

  // Determine which statuses to query based on the view param
  const statusFilter =
    view === 'controlled' ? CONTROLLED_STATUS
    : view === 'review'   ? REVIEW_STATUSES
    : ALL_PORTAL_STATUSES

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { status: { in: statusFilter } }

  if (search.trim()) {
    where.AND = [
      { status: { in: statusFilter } },
      {
        OR: [
          { title:          { contains: search.trim(), mode: 'insensitive' } },
          { description:    { contains: search.trim(), mode: 'insensitive' } },
          { documentNumber: { contains: search.trim(), mode: 'insensitive' } },
          { tags:           { contains: search.trim(), mode: 'insensitive' } },
          { purpose:        { contains: search.trim(), mode: 'insensitive' } },
        ],
      },
    ]
    delete where.status
  }

  if (type) where.category = type

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orderBy: any
  switch (sort) {
    case 'date_asc':    orderBy = { updatedAt: 'asc' };       break
    case 'title':       orderBy = { title: 'asc' };           break
    case 'title_desc':  orderBy = { title: 'desc' };          break
    case 'number':      orderBy = { documentNumber: 'asc' };  break
    default:            orderBy = { updatedAt: 'desc' };      break
  }

  const [total, documents] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      orderBy,
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, title: true, category: true, documentNumber: true,
        revision: true, fileSize: true, fileType: true, status: true,
        controlledAt: true, updatedAt: true,
        description: true,
      },
    }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasFilters = !!(search || type)
  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Newest First'

  function buildUrl(params: Record<string, string | undefined>) {
    const p = new URLSearchParams()
    const s = params.search !== undefined ? params.search : search
    const t = params.type  !== undefined ? params.type  : type
    const so = params.sort !== undefined ? params.sort  : sort
    const pg = params.page !== undefined ? params.page  : '1'
    const v  = params.view !== undefined ? params.view  : view
    if (s)  p.set('search', s)
    if (t)  p.set('type', t)
    if (so !== 'date') p.set('sort', so)
    if (pg !== '1')    p.set('page', pg)
    if (v !== 'all')   p.set('view', v)
    const qs = p.toString()
    return `/portal/documents${qs ? '?' + qs : ''}`
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Document Library</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {total.toLocaleString()} document{total !== 1 ? 's' : ''}
          {hasFilters ? ' matching your filters' : ''}
        </p>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-100 bg-white shadow-sm p-1.5 mb-4 w-fit">
        {[
          { value: 'all',        label: 'All Documents' },
          { value: 'controlled', label: 'Controlled' },
          { value: 'review',     label: 'Under Review' },
        ].map((tab) => (
          <Link
            key={tab.value}
            href={buildUrl({ view: tab.value, page: '1' })}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              view === tab.value
                ? 'text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
            style={view === tab.value ? { backgroundColor: '#1C3557' } : {}}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Filter bar */}
      <div className="mb-6 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        <form className="flex flex-wrap gap-3 items-end">
          {/* Keep view param */}
          {view !== 'all' && <input type="hidden" name="view" value={view} />}

          {/* Search */}
          <div className="relative flex-1 min-w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              name="search"
              defaultValue={search}
              placeholder="Search title, number, tags…"
              className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>

          {/* Document type */}
          <div className="relative">
            <select
              name="type"
              defaultValue={type}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all pr-8"
            >
              <option value="">All types</option>
              {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Sort */}
          <div className="relative flex items-center">
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <select
              name="sort"
              defaultValue={sort}
              className="rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-2 text-sm text-gray-700 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
            >
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: '#1C3557' }}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter
          </button>

          {hasFilters && (
            <Link
              href={buildUrl({ search: '', type: '', page: '1' })}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Link>
          )}
        </form>

        {/* Active filter chips */}
        {(hasFilters || sort !== 'date') && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-50">
            {search && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                &ldquo;{search}&rdquo;
                <Link href={buildUrl({ search: '', page: '1' })} className="text-blue-400 hover:text-blue-700">
                  <X className="h-3 w-3" />
                </Link>
              </span>
            )}
            {type && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: '#E8EDF4', color: '#1C3557' }}
              >
                {type}
                <Link href={buildUrl({ type: '', page: '1' })} className="opacity-50 hover:opacity-100">
                  <X className="h-3 w-3" />
                </Link>
              </span>
            )}
            {sort !== 'date' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                {currentSortLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Document grid */}
      {documents.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-16 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Documents Found</h3>
          <p className="text-sm text-gray-400 mb-4">
            {hasFilters ? 'Try adjusting your search or filters.' : 'No documents are available in this view yet.'}
          </p>
          {hasFilters && (
            <Link href={buildUrl({ search: '', type: '', page: '1' })} className="text-sm font-medium hover:underline" style={{ color: '#1C3557' }}>
              Clear all filters
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {documents.map((doc) => {
            const cfg = STATUS_CONFIG[doc.status] ?? { label: doc.status, bg: '#F3F4F6', color: '#374151' }
            const isControlled = doc.status === 'CONTROLLED'
            const dateLabel = isControlled ? formatDate(doc.controlledAt) : formatDate(doc.updatedAt)

            return (
              <div
                key={doc.id}
                className="group relative flex flex-col rounded-xl border border-gray-100 bg-white shadow-sm hover:border-[#1C3557]/30 hover:shadow-md transition-all overflow-hidden"
              >
                {/* Status colour stripe */}
                <div className="h-1 w-full" style={{ backgroundColor: cfg.color }} />

                <div className="flex flex-col flex-1 p-4">
                  {/* Icon + status badge */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: cfg.bg }}
                    >
                      {isControlled
                        ? <CheckCircle2 className="h-4 w-4" style={{ color: cfg.color }} />
                        : <Clock        className="h-4 w-4" style={{ color: cfg.color }} />
                      }
                    </div>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold flex-shrink-0"
                      style={{ backgroundColor: cfg.bg, color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                  </div>

                  {/* Title */}
                  <Link href={`/portal/documents/${doc.id}`} className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug group-hover:text-[#1C3557] transition-colors">
                      {doc.title}
                    </h3>
                  </Link>

                  {/* Doc number + revision */}
                  {(doc.documentNumber || doc.revision) && (
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400 font-mono">
                      {doc.documentNumber && <span>{doc.documentNumber}</span>}
                      {doc.documentNumber && doc.revision && <span>·</span>}
                      {doc.revision && <span>Rev {doc.revision}</span>}
                    </div>
                  )}

                  {/* Category */}
                  {doc.category && (
                    <span className="mt-2 self-start rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 truncate max-w-full">
                      {doc.category}
                    </span>
                  )}

                  {/* Footer: date + download */}
                  <div className="mt-auto pt-3 flex items-center justify-between border-t border-gray-50 mt-3">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Calendar className="h-3 w-3" />
                      {dateLabel}
                    </div>
                    {isControlled && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400">{formatFileSize(doc.fileSize)}</span>
                        <a
                          href={`/api/documents/${doc.id}/file`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-center h-7 w-7 rounded-lg transition-colors hover:text-white"
                          style={{ backgroundColor: '#E8EDF4', color: '#1C3557' }}
                          title="Download"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {((pageNum - 1) * PAGE_SIZE) + 1}–{Math.min(pageNum * PAGE_SIZE, total)} of {total.toLocaleString()} documents
          </p>
          <div className="flex items-center gap-2">
            {pageNum > 1 ? (
              <Link
                href={buildUrl({ page: String(pageNum - 1) })}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Link>
            ) : (
              <span className="flex items-center gap-1.5 rounded-lg border border-gray-100 px-3 py-2 text-sm font-medium text-gray-300 cursor-not-allowed">
                <ChevronLeft className="h-4 w-4" />
                Previous
              </span>
            )}

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let p: number
                if (totalPages <= 7) {
                  p = i + 1
                } else if (pageNum <= 4) {
                  p = i + 1
                } else if (pageNum >= totalPages - 3) {
                  p = totalPages - 6 + i
                } else {
                  p = pageNum - 3 + i
                }
                return (
                  <Link
                    key={p}
                    href={buildUrl({ page: String(p) })}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      p === pageNum ? 'text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    style={p === pageNum ? { backgroundColor: '#1C3557' } : {}}
                  >
                    {p}
                  </Link>
                )
              })}
            </div>

            {pageNum < totalPages ? (
              <Link
                href={buildUrl({ page: String(pageNum + 1) })}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="flex items-center gap-1.5 rounded-lg border border-gray-100 px-3 py-2 text-sm font-medium text-gray-300 cursor-not-allowed">
                Next
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
