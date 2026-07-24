import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { FileText, CheckCircle, AlertCircle, AlertTriangle, ArrowRight } from 'lucide-react'
import StatsCard from '@/components/dashboard/StatsCard'
import StatusChart from '@/components/dashboard/StatusChart'
import StatusBadge from '@/components/documents/StatusBadge'
import { REVIEW_SLA_HOURS } from '@/lib/sla'
import type { DocumentStatus } from '@/types'

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function greetingByHour() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const roleLabels: Record<string, string> = {
  ADMIN:            'Admin',
  DOCUMENT_MANAGER: 'Document Controller',
  REVIEWER:         'Reviewer',
  APPROVER:         'Approver',
}

const roleColors: Record<string, { bg: string; text: string }> = {
  ADMIN:            { bg: '#FEE2E2', text: '#991B1B' },
  DOCUMENT_MANAGER: { bg: '#E8EDF4', text: '#1C3557' },
  REVIEWER:         { bg: '#EDE9FE', text: '#5B21B6' },
  APPROVER:         { bg: '#DCFCE7', text: '#166534' },
}

const ALL_STATUSES: DocumentStatus[] = [
  'REGISTERED', 'DRAFT', 'PENDING_REVIEW', 'IN_REVIEW', 'UPDATING', 'REVIEW_COMPLETE',
  'FINAL_DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'CONTROLLED',
]

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) return null

  let myDocs: { id: string; title: string; status: DocumentStatus; updatedAt: Date; category: string | null }[] = []
  let pendingAction: { id: string; title: string; status: DocumentStatus; updatedAt: Date }[] = []
  let completedReviews: { id: string; document: { id: string; title: string; status: DocumentStatus; updatedAt: Date }; reviewedAt: Date | null }[] = []

  if (session.role === 'DOCUMENT_MANAGER' || session.role === 'ADMIN') {
    myDocs = await prisma.document.findMany({
      where: {},
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: { id: true, title: true, status: true, updatedAt: true, category: true },
    }) as typeof myDocs
  }

  if (session.role === 'REVIEWER' || session.role === 'ADMIN') {
    pendingAction = await prisma.document.findMany({
      where: {
        status: 'IN_REVIEW',
        reviews: { some: { reviewerId: session.userId, status: 'IN_PROGRESS' } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: { id: true, title: true, status: true, updatedAt: true },
    }) as typeof pendingAction
  }

  if (session.role === 'APPROVER' || session.role === 'ADMIN') {
    const approverDocs = await prisma.document.findMany({
      where: {
        status: 'PENDING_APPROVAL',
        reviews: { some: { reviewerId: session.userId, isApprover: true, status: 'IN_PROGRESS' } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: { id: true, title: true, status: true, updatedAt: true },
    }) as typeof pendingAction
    pendingAction = [...pendingAction, ...approverDocs]
  }

  // S18: Completed review/approval actions for reviewer/approver roles
  if (session.role === 'REVIEWER' || session.role === 'APPROVER' || session.role === 'ADMIN') {
    completedReviews = await prisma.documentReview.findMany({
      where: {
        reviewerId: session.userId,
        status: { in: ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED'] },
      },
      include: { document: { select: { id: true, title: true, status: true, updatedAt: true } } },
      orderBy: { reviewedAt: 'desc' },
      take: 6,
    }) as typeof completedReviews
  }

  // Stats
  const scopeWhere = (session.role === 'ADMIN' || session.role === 'DOCUMENT_MANAGER') ? {} : { uploadedById: session.userId }
  const totalDocs = await prisma.document.count({ where: scopeWhere })
  const approvedDocs = await prisma.document.count({ where: { ...scopeWhere, status: 'APPROVED' } })

  const slaDeadline = new Date(Date.now() - REVIEW_SLA_HOURS * 3600 * 1000)
  const overdueReviews = await prisma.documentReview.count({
    where: {
      status: 'IN_PROGRESS',
      startedAt: { lt: slaDeadline },
      ...(session.role === 'REVIEWER' ? { reviewerId: session.userId } : {}),
    },
  })

  // Status distribution for chart
  const statusCounts = await Promise.all(
    ALL_STATUSES.map(async (status) => ({
      status,
      count: await prisma.document.count({ where: { ...scopeWhere, status } }),
    }))
  )

  // Document type distribution
  const docTypeCategories = [
    'Policy', 'Procedure', 'Work Practice', 'Work Instruction',
    'Strategy & Planning', 'Risk Matrix', 'Standard', 'Guidelines',
    'Training Material', 'Form / Template',
  ]
  const categoryScope = (session.role === 'ADMIN' || session.role === 'DOCUMENT_MANAGER') ? {} : { uploadedById: session.userId }
  const categoryCounts = await Promise.all(
    docTypeCategories.map(async (cat) => ({
      category: cat,
      count: await prisma.document.count({ where: { ...categoryScope, category: cat } }),
    }))
  )
  const nonZeroCategories = categoryCounts.filter((c) => c.count > 0)

  const roleStyle = roleColors[session.role] ?? { bg: '#F3F4F6', text: '#374151' }
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Welcome bar */}
      <div
        className="rounded-xl p-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1C3557 0%, #142840 100%)' }}
      >
        <div
          className="absolute -top-8 -right-8 h-48 w-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #F5A623, transparent)' }}
        />
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: '#F5A623' }}>
              {greetingByHour()}, {session.name.split(' ')[0]}
            </p>
            <h1 className="text-2xl font-bold text-white">SANPC Document Management</h1>
            <p className="text-white/50 text-sm mt-1">{today}</p>
          </div>
          <span
            className="rounded-full px-4 py-1.5 text-sm font-semibold flex-shrink-0"
            style={{ backgroundColor: roleStyle.bg, color: roleStyle.text }}
          >
            {roleLabels[session.role] ?? session.role}
          </span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          icon={FileText}
          label={session.role === 'ADMIN' ? 'Total Documents' : 'My Documents'}
          value={totalDocs}
        />
        <StatsCard
          icon={CheckCircle}
          label="Approved"
          value={approvedDocs}
        />
        <StatsCard
          icon={AlertCircle}
          label="Pending My Action"
          value={pendingAction.length}
        />
        <StatsCard
          icon={AlertTriangle}
          label="Overdue Reviews"
          value={overdueReviews}
          alertColor={overdueReviews > 0}
        />
      </div>

      {/* Chart + Pending Actions */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Status Chart */}
        <div className="lg:col-span-5 rounded-xl border border-gray-100 bg-white shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Document Status Overview</h2>
          <StatusChart data={statusCounts} />
        </div>

        {/* Pending Actions */}
        <div className="lg:col-span-7 rounded-xl border border-gray-100 bg-white shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Needs Your Attention
            </h2>
            {pendingAction.length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {pendingAction.length} item{pendingAction.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {pendingAction.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <CheckCircle className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">All caught up! No pending actions.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingAction.slice(0, 6).map((doc) => (
                <Link key={doc.id} href={`/documents/${doc.id}`}>
                  <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:border-amber-200 hover:bg-amber-50/50 transition-all group">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{doc.title}</p>
                      <p className="text-xs text-gray-400">{formatDate(doc.updatedAt)}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      <StatusBadge status={doc.status} />
                      <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-amber-500 transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* S18: Recently Completed Reviews */}
      {completedReviews.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Recently Completed
            </h2>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              {completedReviews.length} action{completedReviews.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2">
            {completedReviews.map((review) => (
              <Link key={review.id} href={`/documents/${review.document.id}`}>
                <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:border-green-200 hover:bg-green-50/50 transition-all group">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{review.document.title}</p>
                    <p className="text-xs text-gray-400">{review.reviewedAt ? formatDate(new Date(review.reviewedAt)) : formatDate(review.document.updatedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <StatusBadge status={review.document.status} />
                    <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-green-500 transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Document Type Breakdown */}
      {nonZeroCategories.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#1C3557]" />
                Documents by Type
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Click a type to view only those documents</p>
            </div>
            <Link
              href="/documents"
              className="text-xs font-semibold text-[#1C3557] hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {nonZeroCategories.map(({ category, count }) => (
              <Link
                key={category}
                href={`/documents?category=${encodeURIComponent(category)}`}
                className="group flex flex-col rounded-xl border border-gray-100 bg-gray-50 p-4 hover:border-[#1C3557] hover:bg-[#E8EDF4] transition-all"
              >
                <span className="text-3xl font-bold text-[#1C3557] leading-none">{count}</span>
                <span className="text-xs font-semibold text-gray-700 mt-2 leading-snug group-hover:text-[#1C3557]">
                  {category}
                </span>
                <span className="text-[10px] text-gray-400 mt-2 flex items-center gap-0.5 group-hover:text-[#1C3557] transition-colors">
                  View documents <ArrowRight className="h-2.5 w-2.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Documents Table */}
      {myDocs.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <FileText className="h-4 w-4 text-sanpc-navy" />
              {session.role === 'ADMIN' ? 'Recent Documents' : 'My Recent Documents'}
            </h2>
            <Link
              href="/documents"
              className="text-xs font-semibold hover:underline flex items-center gap-1"
              style={{ color: '#1C3557' }}
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Document</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Category</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Updated</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {myDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-800 truncate max-w-[200px]">{doc.title}</p>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className="text-xs text-gray-500 truncate max-w-[120px] block">
                        {doc.category ?? '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-xs text-gray-400">{formatDate(doc.updatedAt)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="text-xs font-medium text-gray-400 group-hover:text-sanpc-navy transition-colors"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
