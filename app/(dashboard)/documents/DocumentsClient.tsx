'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FileText, LayoutGrid, List, Download, Trash2, Eye,
  ChevronLeft, ChevronRight, MoreHorizontal, FilePlus, Paperclip,
  CheckCircle2, Clock,
} from 'lucide-react'
import StatusBadge from '@/components/documents/StatusBadge'
import DocumentCard from '@/components/documents/DocumentCard'
import type { Document, DocumentReview } from '@/types'

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function avatarInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

/** All assigned approvers that have not been removed */
function getApprovers(doc: Document): DocumentReview[] {
  return (doc.reviews ?? []).filter((r) => r.isApprover && r.status !== 'REMOVED')
}

const PAGE_SIZE = 10

interface Props {
  documents: Document[]
  canCreate: boolean
  userId: string
  userRole: string
  hasFilters: boolean
}

export default function DocumentsClient({ documents, canCreate, userId, userRole, hasFilters }: Props) {
  const canDelete = (doc: Document) => userRole === 'ADMIN' || doc.uploadedById === userId
  const [view, setView] = useState<'table' | 'grid'>('table')
  const [page, setPage] = useState(1)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Close menu on outside click or scroll
  useEffect(() => {
    if (!openMenu) return
    function close() { setOpenMenu(null); setMenuPos(null) }
    document.addEventListener('mousedown', close)
    document.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('scroll', close, true)
    }
  }, [openMenu])

  function toggleMenu(docId: string, e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    if (openMenu === docId) { setOpenMenu(null); setMenuPos(null); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setOpenMenu(docId)
  }

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
      <div className="flex flex-col items-center justify-center py-24 rounded-xl border border-dashed border-gray-200 bg-white text-gray-400">
        <div className="rounded-2xl bg-gray-50 p-5 mb-4">
          <FilePlus className="h-10 w-10 text-gray-300" />
        </div>
        {hasFilters ? (
          <>
            <p className="text-base font-semibold text-gray-500 mb-1">No documents match your filters</p>
            <p className="text-sm text-gray-400 mb-5">Try adjusting or clearing your search and filter criteria</p>
            <Link
              href="/documents"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Clear filters
            </Link>
          </>
        ) : (
          <>
            <p className="text-base font-semibold text-gray-500 mb-1">No documents yet</p>
            <p className="text-sm text-gray-400 mb-5">Get started by uploading your first document</p>
            {canCreate && (
              <Link
                href="/documents/new"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all shadow-sm hover:shadow-md active:scale-95"
                style={{ backgroundColor: '#1C3557' }}
              >
                <FilePlus className="h-4 w-4" />
                Upload First Document
              </Link>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* View toggle + count */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">
          Showing{' '}
          <span className="font-medium text-gray-700">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, documents.length)}
          </span>
          {' '}of{' '}
          <span className="font-medium text-gray-700">{documents.length}</span>{' '}
          document{documents.length !== 1 ? 's' : ''}
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
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Document</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Status</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Category</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Doc Control</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden xl:table-cell">Originator</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden xl:table-cell">Approver(s)</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Updated</th>
                  <th className="px-5 py-3.5 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pageDocs.map((doc) => {
                  const approvers = getApprovers(doc)
                  const allApproved = approvers.length > 0 && approvers.every((r) => r.status === 'APPROVED')
                  const approverNames = approvers.map((r) => r.reviewer.name)
                  const approverLabel =
                    approverNames.length === 0
                      ? null
                      : approverNames.length <= 2
                        ? approverNames.join(', ')
                        : `${approverNames[0]}, +${approverNames.length - 1} more`

                  const originatorName = doc.originatorUser?.name ?? doc.originator ?? null

                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
                      onClick={() => router.push(`/documents/${doc.id}`)}
                    >
                      {/* Document cell */}
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5 rounded-lg bg-sanpc-navy-light p-2 group-hover:bg-blue-100/70 transition-colors">
                            <FileText className="h-4 w-4 text-sanpc-navy" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate max-w-[220px] group-hover:text-sanpc-navy transition-colors">
                              {doc.title}
                            </p>
                            {doc.documentNumber ? (
                              <p className="text-xs font-mono text-sanpc-navy/60 truncate max-w-[200px]">
                                {doc.documentNumber} · Rev {doc.revision ?? '00'}
                              </p>
                            ) : doc.description ? (
                              <p className="text-xs text-gray-400 truncate max-w-[200px]">{doc.description}</p>
                            ) : null}
                            {/* Originator shown inline on screens narrower than xl (where the column is hidden) */}
                            {originatorName && (
                              <p className="text-xs text-gray-400 truncate max-w-[200px] xl:hidden mt-0.5">
                                <span className="text-gray-300">Originator:</span>{' '}{originatorName}
                              </p>
                            )}
                            {/* Attachment indicator */}
                            {(doc as unknown as { _count?: { attachments: number } })._count?.attachments ? (
                              <Link
                                href={`/documents/${doc.id}#attachments`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-teal-600 hover:text-teal-800 font-medium"
                                title="View attachments"
                              >
                                <Paperclip className="h-3 w-3" />
                                {(doc as unknown as { _count?: { attachments: number } })._count!.attachments}{' '}
                                attachment{(doc as unknown as { _count?: { attachments: number } })._count!.attachments !== 1 ? 's' : ''}
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 hidden sm:table-cell">
                        <StatusBadge status={doc.status} />
                      </td>

                      {/* Category */}
                      <td className="px-5 py-4 hidden md:table-cell">
                        <span className="text-xs text-gray-500 truncate max-w-[120px] block">{doc.category ?? '—'}</span>
                      </td>

                      {/* Doc Control — person who uploaded */}
                      <td className="px-5 py-4 hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-sanpc-navy-light text-[9px] font-bold text-sanpc-navy">
                            {avatarInitials(doc.uploadedBy.name)}
                          </span>
                          <span className="text-xs text-gray-600 truncate max-w-[110px]">{doc.uploadedBy.name}</span>
                        </div>
                      </td>

                      {/* Originator */}
                      <td className="px-5 py-4 hidden xl:table-cell">
                        {originatorName ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-50 text-[9px] font-bold text-amber-700">
                              {avatarInitials(originatorName)}
                            </span>
                            <span className="text-xs text-gray-600 truncate max-w-[110px]">{originatorName}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Approver(s) */}
                      <td className="px-5 py-4 hidden xl:table-cell">
                        {approverLabel ? (
                          <div className="flex items-center gap-1.5">
                            {allApproved
                              ? <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                              : <Clock className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
                            }
                            <span className="text-xs text-gray-700 truncate max-w-[110px]">{approverLabel}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Updated date */}
                      <td className="px-5 py-4 hidden lg:table-cell">
                        <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(doc.updatedAt)}</span>
                      </td>

                      {/* Row actions */}
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => toggleMenu(doc.id, e)}
                          className="rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                          aria-label="Document actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
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

      {/* Fixed-position action menu — escapes overflow:hidden parents */}
      {openMenu && menuPos && (() => {
        const doc = pageDocs.find((d) => d.id === openMenu)
        if (!doc) return null
        return (
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
            className="w-36 rounded-lg border border-gray-100 bg-white shadow-xl py-1 ring-1 ring-black/5"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Link
              href={`/documents/${doc.id}`}
              className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => { setOpenMenu(null); setMenuPos(null) }}
            >
              <Eye className="h-3.5 w-3.5 text-gray-400" />
              View
            </Link>
            <a
              href={`/api/documents/${doc.id}/file`}
              download={doc.fileName}
              className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => { setOpenMenu(null); setMenuPos(null) }}
            >
              <Download className="h-3.5 w-3.5 text-gray-400" />
              Download
            </a>
            {canDelete(doc) && (
              <>
                <div className="my-1 border-t border-gray-100" />
                <button
                  onClick={(e) => handleDelete(doc, e)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </>
            )}
          </div>
        )
      })()}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5">
          <p className="text-xs text-gray-400">
            Page <span className="font-medium text-gray-600">{page}</span> of <span className="font-medium text-gray-600">{totalPages}</span>
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                  className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors ${
                    p === page
                      ? 'text-white shadow-sm'
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                  style={p === page ? { backgroundColor: '#1C3557' } : {}}
                >
                  {p}
                </button>
              )
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
