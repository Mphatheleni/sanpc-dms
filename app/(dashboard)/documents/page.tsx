import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { FilePlus, Search } from 'lucide-react'
import DocumentsClient from './DocumentsClient'
import type { Document as DmsDocument, DocumentStatus } from '@/types'

interface PageProps {
  searchParams: Promise<{ search?: string; status?: string; category?: string }>
}

export default async function DocumentsPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) return null

  const { search = '', status = '', category = '' } = await searchParams

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (session.role === 'DOCUMENT_MANAGER') where.uploadedById = session.userId
  else if (session.role === 'REVIEWER') where.reviews = { some: { reviewerId: session.userId } }
  else if (session.role === 'APPROVER') where.reviews = { some: { reviewerId: session.userId, isApprover: true } }

  if (search) where.OR = [{ title: { contains: search } }, { description: { contains: search } }]
  if (status) where.status = status
  if (category) where.category = category

  const documents = await prisma.document.findMany({
    where,
    include: {
      uploadedBy: { select: { id: true, name: true, email: true, role: true } },
      metadata: true,
      reviews: {
        include: { reviewer: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { order: 'asc' },
      },
      comments: {
        include: { author: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const statuses: DocumentStatus[] = [
    'DRAFT', 'IN_REVIEW', 'REVIEW_COMPLETE', 'PENDING_APPROVAL', 'APPROVED',
    'EXCO_PENDING', 'CONTROLLED', 'SUPERSEDED', 'CANCELLED', 'REJECTED', 'CHANGES_REQUESTED', 'PENDING_REVIEW',
  ]

  const statusLabels: Record<DocumentStatus, string> = {
    DRAFT: 'Draft',
    PENDING_REVIEW: 'Pending Review',
    IN_REVIEW: 'RV — In Review',
    REVIEW_COMPLETE: 'RU — Request Update',
    PENDING_APPROVAL: 'FD — Final Draft',
    APPROVED: 'AP — Approved',
    EXCO_PENDING: 'EXCO Pending',
    REJECTED: 'Rejected',
    CHANGES_REQUESTED: 'Changes Requested',
    CONTROLLED: 'Controlled',
    SUPERSEDED: 'Superseded',
    CANCELLED: 'Cancelled',
  }

  const canCreate = session.role === 'DOCUMENT_MANAGER' || session.role === 'ADMIN'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {documents.length} document{documents.length !== 1 ? 's' : ''}
            {(search || status || category) ? ' matching filters' : ''}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/documents/new"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all shadow-sm hover:shadow-md"
            style={{ backgroundColor: '#1C3557' }}
          >
            <FilePlus className="h-4 w-4" />
            New Document
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        <form className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              name="search"
              defaultValue={search}
              placeholder="Search documents…"
              className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
          <select
            name="status"
            defaultValue={status}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-white"
          >
            <option value="">All statuses</option>
            {statuses.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
          </select>
          <select
            name="category"
            defaultValue={category}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-white"
          >
            <option value="">All document types</option>
            <option>Policy</option>
            <option>Procedure</option>
            <option>Work Practice</option>
            <option>Work Instruction</option>
            <option>Strategy &amp; Planning</option>
            <option>Risk Matrix</option>
            <option>Standard</option>
            <option>Guidelines</option>
            <option>Training Material</option>
            <option>Test Script</option>
            <option>Process Flow</option>
            <option>Form / Template</option>
            <option>Corporate Governance</option>
            <option>Internal Specification</option>
            <option>Business Continuity Plan</option>
            <option>Terms of Reference</option>
            <option>Management System Manual</option>
          </select>
          <button
            type="submit"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: '#1C3557' }}
          >
            Filter
          </button>
          {(search || status || category) && (
            <Link
              href="/documents"
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {/* Document list */}
      <DocumentsClient
        documents={documents as unknown as DmsDocument[]}
        canCreate={canCreate}
        userId={session.userId}
        userRole={session.role}
      />
    </div>
  )
}
