'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FileText, LayoutGrid, List, Download, Trash2, Eye,
  ChevronLeft, ChevronRight, MoreHorizontal, FilePlus,
} from 'lucide-react'
import StatusBadge from '@/components/documents/StatusBadge'
import DocumentCard from '@/components/documents/DocumentCard'
import type { Document } from '@/types'

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const PAGE_SIZE = 10

interface Props {
  documents: Document[]
  canCreate: boolean
  userId: string
  userRole: string
}

export default function DocumentsClient({ documents, canCreate, userId, userRole }: Props) {
  const canDelete = (doc: Document) => userRole === 'ADMIN' || doc.uploadedById === userId
  const [view, setView] = useState<'table' | 'grid'>('table')
  const [page, setPage] = useState(1)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const router = useRouter()

  const totalPages = Math.max(1, Math.ceil(documents.length / PAGE_SIZE))
  const pageDocs = documents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  async function handleDelete(doc: Document, e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return
    const res = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' })
    if (res.ok) router.refresh()
    setOpenMenu(null)
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <FilePlus className="h-14 w-14 mb-4 opacity-20" />
        <p className="text-base font-medium text-gray-500 mb-1">No documents found</p>
        <p className="text-sm text-gray-400 mb-4">Try adjusting your search or filters</p>
        {canCreate && (
          <Link
            href="/documents/new"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all shadow-sm hover:shadow-md"
            style={{ backgroundColor: '#1C3557' }}
          >
            <FilePlus className="h-4 w-4" />
            Upload First Document
          </Link>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* View toggle + count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          Showing <span className="font-medium text-gray-700">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, documents.length)}</span> of <span className="font-medium text-gray-700">{documents.length}</span> documents
        </p>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
          <button
            onClick={() => setView('table')}
            className={`rounded-md p-1.5 transition-colors ${view === 'table' ? 'bg-sanpc-navy text-white' : 'text-gray-400 hover:text-gray-600'}`}
            title="Table view"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView('grid')}
            className={`rounded-md p-1.5 transition-colors ${view === 'grid' ? 'bg-sanpc-navy text-white' : 'text-gray-400 hover:text-gray-600'}`}
            title="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {view === 'table' ? (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Document</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Category</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Uploaded By</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Date</th>
                  <th className="px-5 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pageDocs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer group"
                    onClick={() => router.push(`/documents/${doc.id}`)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 rounded-lg bg-sanpc-navy-light p-2">
                          <FileText className="h-4 w-4 text-sanpc-navy" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate max-w-[200px]">{doc.title}</p>
                          {doc.documentNumber ? (
                            <p className="text-xs font-mono text-sanpc-navy truncate max-w-[180px]">
                              {doc.documentNumber} · Rev {doc.revision ?? '00'}
                            </p>
                          ) : doc.description ? (
                            <p className="text-xs text-gray-400 truncate max-w-[180px]">{doc.description}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className="text-xs text-gray-500 truncate max-w-[120px] block">{doc.category ?? '—'}</span>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <span className="text-xs text-gray-600">{doc.uploadedBy.name}</span>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <span className="text-xs text-gray-400">{formatDate(doc.updatedAt)}</span>
                    </td>
                    <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenu(openMenu === doc.id ? null : doc.id)}
                          className="rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {openMenu === doc.id && (
                          <div className="absolute right-0 top-full mt-1 w-36 rounded-lg border border-gray-200 bg-white shadow-lg z-20 py-1">
                            <Link
                              href={`/documents/${doc.id}`}
                              className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                              onClick={() => setOpenMenu(null)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Link>
                            <a
                              href={`/api/documents/${doc.id}/file`}
                              download={doc.fileName}
                              className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                              onClick={() => setOpenMenu(null)}
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </a>
                            {canDelete(doc) && (
                              <button
                                onClick={(e) => handleDelete(doc, e)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {pageDocs.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-400">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors ${p === page ? 'text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  style={p === page ? { backgroundColor: '#1C3557' } : {}}
                >
                  {p}
                </button>
              )
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
