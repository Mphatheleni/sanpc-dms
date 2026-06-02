import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { FilePlus, Search } from 'lucide-react'
import DocumentCard from '@/components/documents/DocumentCard'
import type { Document, DocumentStatus } from '@/types'

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
    'DRAFT', 'PENDING_REVIEW', 'IN_REVIEW', 'REVIEW_COMPLETE', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED',
  ]

  const statusLabels: Record<DocumentStatus, string> = {
    DRAFT: 'Draft', PENDING_REVIEW: 'Pending Review', IN_REVIEW: 'In Review',
    REVIEW_COMPLETE: 'Review Complete',
    PENDING_APPROVAL: 'Pending Approval', APPROVED: 'Approved', REJECTED: 'Rejected',
    CHANGES_REQUESTED: 'Changes Requested',
  }

  const canCreate = session.role === 'DOCUMENT_MANAGER' || session.role === 'ADMIN'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-500 mt-1">{documents.length} document{documents.length !== 1 ? 's' : ''}</p>
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
      <form className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            name="search"
            defaultValue={search}
            placeholder="Search documents..."
            className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-sanpc-navy focus:outline-none focus:ring-1 focus:ring-sanpc-navy"
          />
        </div>
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sanpc-navy focus:outline-none focus:ring-1 focus:ring-sanpc-navy"
        >
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
        </select>
        <select
          name="category"
          defaultValue={category}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sanpc-navy focus:outline-none focus:ring-1 focus:ring-sanpc-navy"
        >
          <option value="">All categories</option>
          <option>POLICIES AND PROCEDURES</option>
          <option>STANDARD OPERATING PROCEDURES</option>
          <option>WORK INSTRUCTIONS</option>
          <option>FORMS AND TEMPLATES</option>
          <option>REPORTS</option>
          <option>CONTRACTS AND AGREEMENTS</option>
          <option>TECHNICAL DOCUMENTS</option>
          <option>CORRESPONDENCE</option>
          <option>OTHER</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Filter
        </button>
        {(search || status || category) && (
          <Link
            href="/documents"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Document list */}
      {documents.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FilePlus className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No documents found</p>
          {canCreate && (
            <Link href="/documents/new" className="mt-2 inline-block text-sm text-sanpc-navy hover:underline">
              Upload your first document
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <DocumentCard key={doc.id} doc={doc as unknown as Document} />
          ))}
        </div>
      )}
    </div>
  )
}
