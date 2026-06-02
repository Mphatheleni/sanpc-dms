import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { FileText, Clock, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/documents/StatusBadge'
import { REVIEW_SLA_HOURS } from '@/lib/sla'
import type { DocumentStatus } from '@/types'

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) return null

  let myDocs: { id: string; title: string; status: DocumentStatus; updatedAt: Date }[] = []
  let pendingAction: { id: string; title: string; status: DocumentStatus; updatedAt: Date }[] = []

  if (session.role === 'DOCUMENT_MANAGER' || session.role === 'ADMIN') {
    myDocs = await prisma.document.findMany({
      where: session.role === 'ADMIN' ? {} : { uploadedById: session.userId },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: { id: true, title: true, status: true, updatedAt: true },
    }) as { id: string; title: string; status: DocumentStatus; updatedAt: Date }[]
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
    }) as { id: string; title: string; status: DocumentStatus; updatedAt: Date }[]
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
    }) as { id: string; title: string; status: DocumentStatus; updatedAt: Date }[]
    pendingAction = [...pendingAction, ...approverDocs]
  }

  // Stats
  const totalDocs = session.role === 'ADMIN'
    ? await prisma.document.count()
    : await prisma.document.count({ where: { uploadedById: session.userId } })
  const approvedDocs = session.role === 'ADMIN'
    ? await prisma.document.count({ where: { status: 'APPROVED' } })
    : await prisma.document.count({ where: { uploadedById: session.userId, status: 'APPROVED' } })

  const slaDeadline = new Date(Date.now() - REVIEW_SLA_HOURS * 3600 * 1000)
  const overdueReviews = await prisma.documentReview.count({
    where: {
      status: 'IN_PROGRESS',
      startedAt: { lt: slaDeadline },
      ...(session.role === 'REVIEWER' ? { reviewerId: session.userId } : {}),
    },
  })

  const stats = [
    {
      label: session.role === 'ADMIN' ? 'Total Documents' : 'My Documents',
      value: totalDocs,
      icon: FileText,
      color: 'text-sanpc-navy bg-sanpc-navy-light',
      alert: false,
    },
    {
      label: 'Approved',
      value: approvedDocs,
      icon: CheckCircle,
      color: 'text-green-600 bg-green-50',
      alert: false,
    },
    {
      label: 'Pending Action',
      value: pendingAction.length,
      icon: AlertCircle,
      color: 'text-yellow-600 bg-yellow-50',
      alert: false,
    },
    {
      label: 'Overdue Reviews',
      value: overdueReviews,
      icon: AlertTriangle,
      color: overdueReviews > 0 ? 'text-red-600 bg-red-50' : 'text-gray-400 bg-gray-100',
      alert: overdueReviews > 0,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div
        className="rounded-xl p-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1C3557 0%, #142840 100%)' }}
      >
        <div
          className="absolute -top-8 -right-8 h-40 w-40 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #F5A623, transparent)' }}
        />
        <p className="text-white/60 text-sm font-medium uppercase tracking-widest mb-1" style={{ color: '#F5A623' }}>
          SANPC Document Management
        </p>
        <h1 className="text-2xl font-bold text-white">Welcome back, {session.name}</h1>
        <p className="text-white/60 text-sm mt-1">Here&apos;s an overview of your document activity.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color, alert }) => (
          <Card key={label} className={`flex items-center gap-4 ${alert ? 'border-red-200 bg-red-50' : ''}`}>
            <div className={`rounded-xl p-3 ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${alert ? 'text-red-700' : 'text-gray-900'}`}>{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Actions */}
        {pendingAction.length > 0 && (
          <Card>
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              Needs Your Attention
            </h2>
            <div className="space-y-2">
              {pendingAction.map((doc) => (
                <Link key={doc.id} href={`/documents/${doc.id}`}>
                  <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:border-gray-200 hover:bg-gray-50 transition-all">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{doc.title}</p>
                      <p className="text-xs text-gray-400">{formatDate(doc.updatedAt)}</p>
                    </div>
                    <StatusBadge status={doc.status} />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {/* Recent Documents */}
        {myDocs.length > 0 && (
          <Card>
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-sanpc-navy" />
              {session.role === 'ADMIN' ? 'Recent Documents' : 'My Recent Documents'}
            </h2>
            <div className="space-y-2">
              {myDocs.slice(0, 8).map((doc) => (
                <Link key={doc.id} href={`/documents/${doc.id}`}>
                  <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:border-gray-200 hover:bg-gray-50 transition-all">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{doc.title}</p>
                      <p className="text-xs text-gray-400">{formatDate(doc.updatedAt)}</p>
                    </div>
                    <StatusBadge status={doc.status} />
                  </div>
                </Link>
              ))}
            </div>
            <Link href="/documents" className="mt-3 block text-center text-xs font-semibold hover:underline" style={{ color: '#1C3557' }}>
              View all documents →
            </Link>
          </Card>
        )}
      </div>
    </div>
  )
}
