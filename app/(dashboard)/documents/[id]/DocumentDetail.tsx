'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Download, FileText, User, Calendar, Tag, Layers,
  CheckCircle, Clock, XCircle, AlertTriangle, UserCheck, X,
  ShieldCheck, FileSignature, Landmark, Archive, UserX,
  Paperclip, Upload, Trash2, ChevronDown,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import StatusBadge from '@/components/documents/StatusBadge'
import MetadataList from '@/components/documents/MetadataList'
import CommentThread from '@/components/documents/CommentThread'
import ReviewPanel from '@/components/documents/ReviewPanel'
import DocumentViewer from '@/components/documents/DocumentViewer'
import ActivityLog from '@/components/documents/ActivityLog'
import VersionHistory from '@/components/documents/VersionHistory'
import { isReviewOverdue, getDeadlineLabel } from '@/lib/sla'
import UserPicker from '@/components/ui/UserPicker'
import type { PickableUser } from '@/components/ui/UserPicker'
import type { Document, SessionUser, DocumentComment, DocumentActivity, DocumentAttachment } from '@/types'

function formatDate(date: string) {
  return new Date(date).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const reviewStatusIcon: Record<string, React.ReactNode> = {
  PENDING:           <Clock className="h-4 w-4 text-gray-400" />,
  IN_PROGRESS:       <Clock className="h-4 w-4 text-sanpc-navy" />,
  APPROVED:          <CheckCircle className="h-4 w-4 text-green-500" />,
  REJECTED:          <XCircle className="h-4 w-4 text-red-500" />,
  CHANGES_REQUESTED: <XCircle className="h-4 w-4 text-yellow-500" />,
  REMOVED:           <UserX className="h-4 w-4 text-gray-400" />,
}

const TABS = ['Overview', 'Reviewer Comments', 'Workflow', 'Attachments', 'History'] as const
type Tab = typeof TABS[number]

// DLT-10: all selectable statuses for manual change
const ALL_STATUSES = [
  'REGISTERED', 'DRAFT', 'PENDING_REVIEW', 'IN_REVIEW', 'UPDATING',
  'REVIEW_COMPLETE', 'FINAL_DRAFT', 'PENDING_APPROVAL', 'APPROVED',
  'EXCO_PENDING', 'CONTROLLED', 'SUPERSEDED', 'CANCELLED',
  'REJECTED', 'CHANGES_REQUESTED',
] as const

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

interface UserOption { id: string; name: string; email: string; role: string }
interface Props { initialDoc: Document; session: SessionUser; users?: UserOption[] }

/** Inline viewer for DOCX/DOC attachments — fetches HTML from the preview route */
function AttachmentDocxViewer({ previewUrl, fileName }: { previewUrl: string; fileName: string }) {
  const [html, setHtml] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch(previewUrl)
      .then(async (r) => {
        const ct = r.headers.get('content-type') || ''
        if (ct.includes('text/html')) {
          setHtml(await r.text())
        } else {
          setFailed(true)
        }
      })
      .catch(() => setFailed(true))
  }, [previewUrl])

  if (failed) return (
    <div className="p-6 text-sm text-gray-400 text-center">Preview unavailable — please download to view.</div>
  )
  if (!html) return (
    <div className="p-6 text-sm text-gray-400 text-center">Loading preview…</div>
  )
  return (
    <iframe
      srcDoc={html}
      className="w-full border-0 bg-white"
      style={{ height: '75vh' }}
      sandbox="allow-same-origin"
      title={fileName}
    />
  )
}

export default function DocumentDetail({ initialDoc, session, users = [] }: Props) {
  const [doc, setDoc] = useState<Document>(initialDoc)
  const [comments, setComments] = useState<DocumentComment[]>(initialDoc.comments)
  const [activities, setActivities] = useState<DocumentActivity[]>(initialDoc.activities)
  // DLT-09: Attachments
  const [attachments, setAttachments] = useState<DocumentAttachment[]>([])
  const [attachUploading, setAttachUploading] = useState(false)
  const [attachError, setAttachError] = useState('')
  const [attachLabel, setAttachLabel] = useState('')
  const [previewingAttach, setPreviewingAttach] = useState<DocumentAttachment | null>(null)
  const attachInputRef = useRef<HTMLInputElement>(null)

  // DLT-10: Manual status change
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [statusChanging, setStatusChanging] = useState(false)
  const [statusReason, setStatusReason] = useState('')
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const statusMenuRef = useRef<HTMLDivElement>(null)

  const [replaceTarget, setReplaceTarget] = useState<{ reviewId: string; isApprover: boolean } | null>(null)
  const [replaceUser, setReplaceUser] = useState<PickableUser | null>(null)
  const [replacing, setReplacing] = useState(false)
  const [addTarget, setAddTarget] = useState<{ isApprover: boolean } | null>(null)
  const [addUser, setAddUser] = useState<PickableUser | null>(null)
  const [adding, setAdding] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('Overview')

  // NF-7.5: Real-time updates — poll every 30 s and also refresh when tab regains focus
  useEffect(() => {
    async function refresh() {
      try {
        const res = await fetch(`/api/documents/${doc.id}`)
        if (!res.ok) return
        const updated = await res.json()
        // Only trigger re-render if something meaningful changed
        if (updated.updatedAt !== doc.updatedAt || updated.status !== doc.status) {
          setDoc((prev) => ({ ...updated, versions: prev.versions, activities: prev.activities }))
          setComments(updated.comments)
        }
      } catch { /* silent */ }
    }

    const interval = setInterval(refresh, 30_000)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [doc.id, doc.updatedAt, doc.status])

  // DLT-09: Load attachments
  useEffect(() => {
    fetch(`/api/documents/${doc.id}/attachments`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setAttachments(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [doc.id, doc.status])

  // DLT-10: Close status menu on outside click
  useEffect(() => {
    if (!statusMenuOpen) return
    function handleOutside(e: MouseEvent) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setStatusMenuOpen(false)
        setPendingStatus(null)
        setStatusReason('')
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [statusMenuOpen])

  // ORIGINATOR is read-only — they can view everything but cannot manage
  const canManage =
    session.role === 'ADMIN' ||
    session.role === 'DOCUMENT_MANAGER' ||
    (doc.uploadedById === session.userId && session.role !== 'ORIGINATOR')

  const isDocumentController = session.role === 'ADMIN' || session.role === 'DOCUMENT_MANAGER'

  async function handleReplaceReviewer() {
    if (!replaceTarget || !replaceUser) return
    setReplacing(true)
    try {
      const res = await fetch(`/api/documents/${doc.id}/replace-reviewer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: replaceTarget.reviewId, newReviewerId: replaceUser.id }),
      })
      if (res.ok) {
        const updated = await res.json()
        setDoc({ ...updated, versions: doc.versions, activities: doc.activities })
        setReplaceTarget(null)
        setReplaceUser(null)
      }
    } finally {
      setReplacing(false)
    }
  }

  async function handleAddReviewer() {
    if (!addTarget || !addUser) return
    setAdding(true)
    try {
      const res = await fetch(`/api/documents/${doc.id}/add-reviewer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newReviewerId: addUser.id, isApprover: addTarget.isApprover }),
      })
      if (res.ok) {
        const updated = await res.json()
        setDoc({ ...updated, versions: doc.versions, activities: doc.activities })
        setAddTarget(null)
        setAddUser(null)
      }
    } finally {
      setAdding(false)
    }
  }

  async function handleRemoveReviewer(reviewId: string) {
    setRemoving(true)
    try {
      const res = await fetch(`/api/documents/${doc.id}/remove-reviewer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId }),
      })
      if (res.ok) {
        const updated = await res.json()
        setDoc({ ...updated, versions: doc.versions, activities: doc.activities })
        setRemoveTarget(null)
      }
    } finally {
      setRemoving(false)
    }
  }

  // DLT-09: Upload attachment
  async function handleAttachUpload(file: File) {
    setAttachUploading(true)
    setAttachError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (attachLabel) fd.append('label', attachLabel)
      const res = await fetch(`/api/documents/${doc.id}/attachments`, { method: 'POST', body: fd })
      if (res.ok) {
        const att = await res.json()
        setAttachments((prev) => [...prev, att])
        setAttachLabel('')
        if (attachInputRef.current) attachInputRef.current.value = ''
      } else {
        const err = await res.json().catch(() => ({}))
        setAttachError(err.error || 'Upload failed')
      }
    } catch { setAttachError('Network error') }
    finally { setAttachUploading(false) }
  }

  async function handleAttachDelete(attachmentId: string) {
    const res = await fetch(`/api/documents/${doc.id}/attachments/${attachmentId}`, { method: 'DELETE' })
    if (res.ok) setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
  }

  // DLT-10: Manual status change
  async function handleSetStatus() {
    if (!pendingStatus) return
    setStatusChanging(true)
    try {
      const res = await fetch(`/api/documents/${doc.id}/set-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: pendingStatus, reason: statusReason || undefined }),
      })
      if (res.ok) {
        const updated = await res.json()
        setDoc({ ...updated, versions: doc.versions, activities: doc.activities })
        if (updated.activities?.length) setActivities(updated.activities)
      }
    } finally {
      setStatusChanging(false)
      setPendingStatus(null)
      setStatusReason('')
      setStatusMenuOpen(false)
    }
  }

  function handleCommentAdded(comment: DocumentComment) {
    setComments((prev) => [...prev, comment])
    setActivities((prev) => [{
      id: `temp-${Date.now()}`,
      action: 'COMMENT_ADDED',
      details: null,
      createdAt: new Date().toISOString(),
      user: { name: session.name, email: session.email },
    }, ...prev])
  }

  function handleDocUpdate(updated: Document) {
    setDoc({ ...updated, versions: doc.versions, activities: doc.activities })
    if (updated.activities?.length) setActivities(updated.activities)
  }

  // Render parallel review group — plain function, NOT a React component, to avoid unmount issues
  function renderReviewGroup(reviews: typeof doc.reviews, label: string, isApproverGroup: boolean) {
    // Exclude REMOVED from the progress count — only count active participants
    const active = reviews.filter((r) => r.status !== 'REMOVED')
    const approved = active.filter((r) => r.status === 'APPROVED').length
    const inProgress = active.filter((r) => r.status === 'IN_PROGRESS').length
    const total = active.length
    const allDone = total > 0 && approved === total
    const anyActive = inProgress > 0

    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              allDone ? 'bg-green-100 text-green-700' :
              anyActive ? 'bg-sanpc-navy-light text-sanpc-navy' :
              'bg-gray-100 text-gray-500'
            }`}>
              {approved}/{total} {isApproverGroup ? 'approved' : 'completed'}
            </span>
            {canManage && (
              <button
                type="button"
                onClick={() => { setAddTarget({ isApprover: isApproverGroup }); setAddUser(null); setReplaceTarget(null); setRemoveTarget(null) }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
              >
                <UserCheck className="h-3 w-3" />
                Add {isApproverGroup ? 'Approver' : 'Reviewer'}
              </button>
            )}
          </div>
        </div>
        {anyActive && !allDone && (
          <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            All {label.toLowerCase()} notified simultaneously
          </p>
        )}
        <div className="space-y-2">
          {reviews.map((review, i) => {
            const isRemoved = review.status === 'REMOVED'
            const overdue = !isRemoved && isReviewOverdue(review.startedAt, review.deadline)
            const deadlineLabel = !isRemoved ? getDeadlineLabel(review.deadline) : null
            const isActive = review.status === 'IN_PROGRESS'
            const isModifiable = review.status === 'IN_PROGRESS' || review.status === 'PENDING'
            return (
              <div
                key={review.id}
                className={`rounded-lg border transition-colors ${
                  isRemoved ? 'border-gray-200 bg-gray-50 opacity-60' :
                  isActive ? 'border-sanpc-navy bg-sanpc-navy-light' :
                  review.status === 'APPROVED' ? 'border-green-200 bg-green-50' :
                  review.status === 'REJECTED' || review.status === 'CHANGES_REQUESTED' ? 'border-red-200 bg-red-50' :
                  'border-gray-100 bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3 p-3">
                  <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    isRemoved ? 'bg-gray-100 text-gray-400 line-through' :
                    review.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                    isActive ? 'bg-white text-sanpc-navy' :
                    review.status === 'REJECTED' || review.status === 'CHANGES_REQUESTED' ? 'bg-red-100 text-red-700' :
                    'bg-white text-gray-400'
                  }`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {reviewStatusIcon[review.status]}
                        <span className={`text-sm font-medium ${isRemoved ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                          {review.reviewer.name}
                        </span>
                        {isRemoved && (
                          <span className="text-xs text-gray-400 italic">(audit record retained)</span>
                        )}
                        {!isRemoved && review.isMandatory && review.mandatoryRole && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 uppercase tracking-wide">
                            {review.mandatoryRole.replace('_', ' ')}
                          </span>
                        )}
                        {deadlineLabel && (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            overdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            <AlertTriangle className="h-3 w-3" />{deadlineLabel}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!isRemoved && !isApproverGroup && review.status === 'APPROVED'
                          ? <Badge variant="success">Completed</Badge>
                          : <StatusBadge status={review.status} />
                        }
                        {canManage && isModifiable && !isRemoved && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (replaceTarget?.reviewId === review.id) {
                                  setReplaceTarget(null); setReplaceUser(null)
                                } else {
                                  setReplaceTarget({ reviewId: review.id, isApprover: isApproverGroup })
                                  setReplaceUser(null)
                                  setRemoveTarget(null)
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                            >
                              <UserCheck className="h-3 w-3" />
                              Replace
                            </button>
                            <button
                              type="button"
                              onClick={() => setRemoveTarget(removeTarget === review.id ? null : review.id)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
                            >
                              <X className="h-3 w-3" />
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {review.comments && <p className="mt-1 text-xs text-gray-500 italic">"{review.comments}"</p>}
                    {review.reviewedAt && !isRemoved && <p className="text-xs text-gray-400 mt-0.5">{formatDate(review.reviewedAt)}</p>}
                  </div>
                </div>

                {replaceTarget?.reviewId === review.id && (() => {
                  const alreadyAssigned = new Set(
                    doc.reviews.filter((r) => r.status !== 'REMOVED').map((r) => r.reviewerId)
                  )
                  const pool = users.filter((u) => {
                    const roleOk = isApproverGroup
                      ? u.role === 'APPROVER' || u.role === 'ADMIN'
                      : u.role === 'REVIEWER' || u.role === 'APPROVER' || u.role === 'ADMIN'
                    return roleOk && !alreadyAssigned.has(u.id)
                  })
                  return (
                    <div className="border-t border-amber-200 bg-amber-50 px-3 py-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-amber-600 flex-shrink-0" />
                        <span className="text-xs font-semibold text-amber-800">Replace with:</span>
                      </div>
                      <div className="flex items-end gap-2 flex-wrap">
                        <div className="flex-1 min-w-[220px]">
                          <UserPicker
                            users={pool}
                            value={replaceUser}
                            onChange={setReplaceUser}
                            placeholder="Search by name or email…"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleReplaceReviewer}
                          disabled={!replaceUser || replacing}
                          className="rounded-md px-3 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {replacing ? 'Replacing…' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setReplaceTarget(null); setReplaceUser(null) }}
                          className="rounded-md p-1.5 text-amber-600 hover:bg-amber-100 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )
                })()}

                {/* Remove confirmation */}
                {removeTarget === review.id && (
                  <div className="border-t border-red-200 bg-red-50 px-3 py-3 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-red-800 flex-1">
                      Remove {review.reviewer.name} from workflow? Their record will be kept as &ldquo;Removed&rdquo; for audit purposes.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveReviewer(review.id)}
                      disabled={removing}
                      className="rounded-md px-3 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {removing ? 'Removing…' : 'Confirm Remove'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(null)}
                      className="rounded-md p-1 text-red-600 hover:bg-red-100 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Add reviewer/approver inline panel — opens when header button clicked */}
        {canManage && addTarget?.isApprover === isApproverGroup && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-amber-800">Add {isApproverGroup ? 'approver' : 'reviewer'}:</span>
            </div>
            <div className="flex items-end gap-2 flex-wrap">
              <div className="flex-1 min-w-[220px]">
                <UserPicker
                  users={users.filter((u) => {
                    const roleOk = isApproverGroup
                      ? u.role === 'APPROVER' || u.role === 'ADMIN'
                      : u.role === 'REVIEWER' || u.role === 'APPROVER' || u.role === 'ADMIN'
                    return roleOk && !doc.reviews.some((r) => r.reviewerId === u.id && r.status !== 'REMOVED')
                  })}
                  value={addUser}
                  onChange={setAddUser}
                  placeholder="Search by name or email…"
                />
              </div>
              <button
                type="button"
                onClick={handleAddReviewer}
                disabled={!addUser || adding}
                className="rounded-md px-3 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {adding ? 'Adding…' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => { setAddTarget(null); setAddUser(null) }}
                className="rounded-md p-1.5 text-amber-600 hover:bg-amber-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const reviewerSteps = doc.reviews.filter((r) => !r.isApprover)
  const approverSteps = doc.reviews.filter((r) => r.isApprover)

  const tabLabels: Record<Tab, string> = {
    Overview: 'Overview',
    'Reviewer Comments': comments.length > 0 ? `Reviewer Comments (${comments.length})` : 'Reviewer Comments',
    Workflow: doc.reviews.length > 0 ? `Workflow (${doc.reviews.length})` : 'Workflow',
    Attachments: attachments.length > 0 ? `Attachments (${attachments.length})` : 'Attachments',
    History: 'History',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/documents" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="flex-1 flex items-center justify-between flex-wrap gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 truncate">{doc.title}</h1>
            </div>
            {(doc.documentNumber || doc.revision) && (
              <div className="flex items-center gap-2 mt-1">
                {doc.documentNumber && (
                  <span className="text-xs font-mono font-semibold text-sanpc-navy bg-sanpc-navy-light px-2 py-0.5 rounded">
                    {doc.documentNumber}
                  </span>
                )}
                {doc.revision && (
                  <span className="text-xs text-gray-500">Rev {doc.revision}</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={doc.status} />

            {/* DLT-10: Manual status change — Document Controller / Admin only */}
            {isDocumentController && (
              <div className="relative" ref={statusMenuRef}>
                <button
                  type="button"
                  onClick={() => { setStatusMenuOpen((o) => !o); setPendingStatus(null); setStatusReason('') }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-sanpc-navy px-3 py-1.5 text-sm font-medium text-sanpc-navy hover:bg-sanpc-navy-light transition-colors"
                >
                  Change Status
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {statusMenuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-gray-200 bg-white shadow-xl">
                    <div className="p-3 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Set status to:</p>
                      <div className="grid grid-cols-2 gap-1">
                        {ALL_STATUSES.map((s) => (
                          <button
                            key={s}
                            type="button"
                            disabled={s === doc.status}
                            onClick={() => setPendingStatus(s)}
                            className={`rounded px-2 py-1 text-xs text-left transition-colors ${
                              pendingStatus === s
                                ? 'bg-sanpc-navy text-white font-semibold'
                                : s === doc.status
                                  ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                  : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {s.replace(/_/g, ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                    {pendingStatus && (
                      <div className="p-3 space-y-2">
                        <input
                          type="text"
                          placeholder="Reason (optional)"
                          value={statusReason}
                          onChange={(e) => setStatusReason(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-sanpc-navy"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleSetStatus}
                            disabled={statusChanging}
                            className="flex-1 rounded-md bg-sanpc-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-sanpc-navy/90 disabled:opacity-50"
                          >
                            {statusChanging ? 'Saving…' : `Set to ${pendingStatus?.replace(/_/g, ' ')}`}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setStatusMenuOpen(false); setPendingStatus(null); setStatusReason('') }}
                            className="rounded-md px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {!pendingStatus && (
                      <div className="p-3 pt-0">
                        <button
                          type="button"
                          onClick={() => setStatusMenuOpen(false)}
                          className="w-full rounded-md px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
                        >
                          Close
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <a
              href={`/api/documents/${doc.id}/file`}
              download={(() => {
                const ext = doc.fileName.split('.').pop() ?? ''
                const base = doc.documentNumber
                  ? `${doc.title} ${doc.documentNumber}`
                  : doc.title
                return ext ? `${base}.${ext}` : base
              })()}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab
                  ? 'border-sanpc-navy text-sanpc-navy'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>
      </div>

      {/* Overview */}
      <div className={activeTab !== 'Overview' ? 'hidden' : ''}>
        {/* W8: All Files — main document + every attachment in one scannable list */}
        <Card className="mb-6">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-gray-400" />
            All Files
            <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">
              {1 + attachments.length}
            </span>
          </h2>
          <div className="divide-y divide-gray-50 -mx-5 px-5">
            {/* Main document row */}
            <div className="flex items-center gap-3 py-3 group">
              <div className="flex-shrink-0 rounded-lg bg-sanpc-navy-light p-1.5">
                <FileText className="h-4 w-4 text-sanpc-navy" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{doc.fileName}</p>
                <p className="text-xs text-gray-400">
                  {doc.fileType || 'Unknown type'} · {doc.uploadedBy.name} · {formatDate(doc.createdAt)}
                </p>
              </div>
              <span className="flex-shrink-0 rounded-full bg-sanpc-navy-light px-2 py-0.5 text-[10px] font-semibold text-sanpc-navy uppercase tracking-wide">
                Main
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <a
                  href={`/api/documents/${doc.id}/preview`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md px-2.5 py-1 text-xs font-medium text-sanpc-navy border border-sanpc-navy/30 hover:bg-sanpc-navy-light transition-colors"
                >
                  View
                </a>
                <a
                  href={`/api/documents/${doc.id}/file`}
                  download={doc.fileName}
                  className="rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Download
                </a>
              </div>
            </div>
            {/* Attachment rows */}
            {attachments.map((att) => (
              <div key={att.id} className="flex items-center gap-3 py-3 group">
                <div className="flex-shrink-0 rounded-lg bg-teal-50 p-1.5">
                  <Paperclip className="h-4 w-4 text-teal-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {att.label || att.fileName}
                  </p>
                  <p className="text-xs text-gray-400">
                    {att.fileType || 'Unknown type'} · {att.uploadedBy.name} · {formatDate(att.createdAt)}
                  </p>
                </div>
                {att.label && (
                  <span className="flex-shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700 uppercase tracking-wide truncate max-w-[80px]">
                    {att.label}
                  </span>
                )}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <a
                    href={`/api/documents/${doc.id}/attachments/${att.id}/preview`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md px-2.5 py-1 text-xs font-medium text-teal-700 border border-teal-200 hover:bg-teal-50 transition-colors"
                  >
                    View
                  </a>
                  <a
                    href={`/api/documents/${doc.id}/attachments/${att.id}/file`}
                    download={att.fileName}
                    className="rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    Download
                  </a>
                </div>
              </div>
            ))}
            {attachments.length === 0 && (
              <p className="py-3 text-xs text-gray-400 italic">No attachments yet.</p>
            )}
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DocumentViewer documentId={doc.id} fileName={doc.fileName} fileType={doc.fileType} />
          </div>
          <div className="space-y-4">
            {doc.purpose && (
              <Card>
                <h2 className="font-semibold text-gray-800 mb-1">Purpose</h2>
                <p className="text-sm text-gray-600 italic">{doc.purpose}</p>
              </Card>
            )}
            {(doc.documentNumber || doc.documentTypeCode || doc.originator || doc.authorisedBy || doc.nextReviewDate || doc.controlledAt || doc.retentionDate) && (
              <Card>
                <h2 className="font-semibold text-gray-800 mb-4">Document Control</h2>
                <dl className="space-y-3 text-sm">
                  {doc.documentNumber && (
                    <div>
                      <dt className="text-xs text-gray-500">Document Number</dt>
                      <dd className="font-mono font-bold text-sanpc-navy">{doc.documentNumber} Rev {doc.revision ?? '00'}</dd>
                    </div>
                  )}
                  {doc.documentTypeCode && (
                    <div>
                      <dt className="text-xs text-gray-500">Document Type</dt>
                      <dd className="text-gray-800">{doc.category} ({doc.documentTypeCode})</dd>
                    </div>
                  )}
                  {doc.originator && (
                    <div>
                      <dt className="text-xs text-gray-500">Originator</dt>
                      <dd className="text-gray-800">{doc.originator}</dd>
                    </div>
                  )}
                  {doc.authorisedBy && (
                    <div>
                      <dt className="text-xs text-gray-500">Approved By</dt>
                      <dd className="text-gray-800">{doc.authorisedBy}</dd>
                    </div>
                  )}
                  {doc.nextReviewDate && (
                    <div>
                      <dt className="text-xs text-gray-500">Next Review Due</dt>
                      <dd className="text-gray-800 font-medium">{new Date(doc.nextReviewDate).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}</dd>
                    </div>
                  )}
                  {doc.controlledAt && (
                    <div className="flex items-start gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <dt className="text-xs text-gray-500">Controlled Date</dt>
                        <dd className="text-gray-800 font-medium">{new Date(doc.controlledAt).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}</dd>
                      </div>
                    </div>
                  )}
                  {doc.retentionDate && (
                    <div className="flex items-start gap-1.5">
                      <Archive className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <dt className="text-xs text-gray-500">Retention Until (40 yrs)</dt>
                        <dd className="text-gray-800">{new Date(doc.retentionDate).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}</dd>
                      </div>
                    </div>
                  )}
                  {doc.signedPageName && (
                    <div className="flex items-start gap-1.5">
                      <FileSignature className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <dt className="text-xs text-gray-500">Signed Page</dt>
                        <dd className="text-green-700 text-xs font-medium">✓ {doc.signedPageName}</dd>
                      </div>
                    </div>
                  )}
                  {doc.excoResolutionName && (
                    <div className="flex items-start gap-1.5">
                      <Landmark className="h-3.5 w-3.5 text-purple-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <dt className="text-xs text-gray-500">EXCO Resolution</dt>
                        <dd className="text-purple-700 text-xs font-medium">✓ {doc.excoResolutionName}</dd>
                      </div>
                    </div>
                  )}
                </dl>
              </Card>
            )}
            <Card>
              <h2 className="font-semibold text-gray-800 mb-4">File Information</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div><dt className="text-xs text-gray-500">File Name</dt><dd className="text-gray-800 break-all">{doc.fileName}</dd></div>
                </div>
                <div className="flex items-start gap-2">
                  <Layers className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div><dt className="text-xs text-gray-500">Size</dt><dd className="text-gray-800">{formatBytes(doc.fileSize)}</dd></div>
                </div>
                <div className="flex items-start gap-2">
                  <Tag className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div><dt className="text-xs text-gray-500">Type</dt><dd className="text-gray-800 break-all">{doc.fileType || '—'}</dd></div>
                </div>
                {doc.category && (
                  <div><dt className="text-xs text-gray-500">Category</dt><dd className="text-gray-800">{doc.category}</dd></div>
                )}
                {doc.tags && (
                  <div>
                    <dt className="text-xs text-gray-500">Tags</dt>
                    <dd className="flex flex-wrap gap-1 mt-1">
                      {doc.tags.split(',').map((tag) => (
                        <span key={tag.trim()} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{tag.trim()}</span>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            </Card>

            <Card>
              <h2 className="font-semibold text-gray-800 mb-4">People</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div><dt className="text-xs text-gray-500">Uploaded By</dt><dd className="text-gray-800">{doc.uploadedBy.name}</dd></div>
                </div>
                {reviewerSteps.length > 0 && (
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <dt className="text-xs text-gray-500">Reviewers</dt>
                      <dd className="text-gray-800 space-y-0.5">
                        {reviewerSteps.map((r, i) => (
                          <div key={r.id} className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-400">#{i + 1}</span>
                            <span>{r.reviewer.name}</span>
                          </div>
                        ))}
                      </dd>
                    </div>
                  </div>
                )}
                {approverSteps.length > 0 && (
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <dt className="text-xs text-gray-500">Approvers</dt>
                      <dd className="text-gray-800 space-y-0.5">
                        {approverSteps.map((r, i) => (
                          <div key={r.id} className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-400">#{i + 1}</span>
                            <span>{r.reviewer.name}</span>
                          </div>
                        ))}
                      </dd>
                    </div>
                  </div>
                )}
              </dl>
            </Card>

            <Card>
              <h2 className="font-semibold text-gray-800 mb-4">Timeline</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div><dt className="text-xs text-gray-500">Created</dt><dd className="text-gray-800">{formatDate(doc.createdAt)}</dd></div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div><dt className="text-xs text-gray-500">Last Updated</dt><dd className="text-gray-800">{formatDate(doc.updatedAt)}</dd></div>
                </div>
              </dl>
            </Card>

            {doc.metadata.length > 0 && (
              <Card>
                <h2 className="font-semibold text-gray-800 mb-4">Metadata</h2>
                <MetadataList metadata={doc.metadata} />
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Workflow — kept mounted so ReviewPanel state persists across tab switches (RV-3.12) */}
      <div className={activeTab !== 'Workflow' ? 'hidden' : 'space-y-6'}>
        <div>
          <ReviewPanel document={doc} session={session} onUpdate={handleDocUpdate} />

          {/* Routing Slip */}
          {doc.reviews.length > 0 && (
            <Card>
              <h2 className="font-semibold text-gray-800 mb-4">Routing Slip</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-gray-400 w-8">#</th>
                      <th className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Name</th>
                      <th className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Role</th>
                      <th className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>
                      <th className="text-left py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {/* Originator row */}
                    {doc.originatorUser && (
                      <tr className="bg-gray-50/50">
                        <td className="py-2 pr-4 text-gray-400 text-xs">—</td>
                        <td className="py-2 pr-4 font-medium text-gray-800">{doc.originatorUser.name}</td>
                        <td className="py-2 pr-4 text-gray-500 text-xs italic">Originator</td>
                        <td className="py-2 pr-4"><span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">—</span></td>
                        <td className="py-2 text-gray-400 text-xs">—</td>
                      </tr>
                    )}

                    {/* ── Reviewers section ── */}
                    {reviewerSteps.length > 0 && (
                      <>
                        <tr>
                          <td colSpan={5} className="bg-blue-50 py-1.5 pl-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Reviewers</span>
                          </td>
                        </tr>
                        {reviewerSteps.map((r, i) => (
                          <tr key={r.id} className={`hover:bg-gray-50 ${r.status === 'REMOVED' ? 'opacity-50' : ''}`}>
                            <td className="py-2 pr-4 text-gray-400 text-xs">{i + 1}</td>
                            <td className="py-2 pr-4 font-medium text-gray-800">
                              <span className={r.status === 'REMOVED' ? 'line-through text-gray-400' : ''}>{r.reviewer.name}</span>
                              {r.isMandatory && r.mandatoryRole && r.status !== 'REMOVED' && (
                                <span className="ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-purple-100 text-purple-700 uppercase tracking-wide">
                                  {r.mandatoryRole.replace('_', ' ')}
                                </span>
                              )}
                            </td>
                            <td className="py-2 pr-4 text-gray-500 text-xs">Reviewer</td>
                            <td className="py-2 pr-4">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                r.status === 'REMOVED' ? 'bg-gray-100 text-gray-400' :
                                r.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                r.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                                r.status === 'REJECTED' || r.status === 'CHANGES_REQUESTED' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-500'
                              }`}>
                                {r.status === 'REMOVED' ? 'Removed' : r.status === 'APPROVED' ? 'Complete' : r.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-2 text-gray-400 text-xs">
                              {r.status === 'REMOVED' ? '—' : r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString('en-ZA') : r.startedAt ? 'In progress' : '—'}
                            </td>
                          </tr>
                        ))}
                      </>
                    )}

                    {/* ── Approvers section ── */}
                    {approverSteps.length > 0 && (
                      <>
                        <tr>
                          <td colSpan={5} className="bg-green-50 py-1.5 pl-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-green-700">Approvers</span>
                          </td>
                        </tr>
                        {approverSteps.map((r, i) => (
                          <tr key={r.id} className={`hover:bg-gray-50 ${r.status === 'REMOVED' ? 'opacity-50' : ''}`}>
                            <td className="py-2 pr-4 text-gray-400 text-xs">{i + 1}</td>
                            <td className="py-2 pr-4 font-medium text-gray-800">
                              <span className={r.status === 'REMOVED' ? 'line-through text-gray-400' : ''}>{r.reviewer.name}</span>
                              {r.isMandatory && r.mandatoryRole && r.status !== 'REMOVED' && (
                                <span className="ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-purple-100 text-purple-700 uppercase tracking-wide">
                                  {r.mandatoryRole.replace('_', ' ')}
                                </span>
                              )}
                            </td>
                            <td className="py-2 pr-4 text-gray-500 text-xs">Approver</td>
                            <td className="py-2 pr-4">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                r.status === 'REMOVED' ? 'bg-gray-100 text-gray-400' :
                                r.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                r.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                                r.status === 'REJECTED' || r.status === 'CHANGES_REQUESTED' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-500'
                              }`}>
                                {r.status === 'REMOVED' ? 'Removed' : r.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-2 text-gray-400 text-xs">
                              {r.status === 'REMOVED' ? '—' : r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString('en-ZA') : r.startedAt ? 'In progress' : '—'}
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {doc.reviews.length > 0 && (
            <Card>
              <h2 className="font-semibold text-gray-800 mb-4">Review Workflow</h2>
              {reviewerSteps.length > 0 && (
                <div className={approverSteps.length > 0 ? 'mb-5' : ''}>
                  {renderReviewGroup(reviewerSteps, 'Reviewers', false)}
                </div>
              )}
              {approverSteps.length > 0 && (
                <div className={reviewerSteps.length > 0 ? 'border-t pt-5' : ''}>
                  {renderReviewGroup(approverSteps, 'Approvers', true)}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Reviewer Comments — kept mounted (RV-3.12) */}
      <div className={activeTab !== 'Reviewer Comments' ? 'hidden' : ''}>
        <Card>
          <h2 className="font-semibold text-gray-800 mb-4">Reviewer Comments</h2>
          <CommentThread documentId={doc.id} comments={comments} onCommentAdded={handleCommentAdded} />
        </Card>
      </div>

      {/* Attachments — available at any point */}
      <div className={activeTab !== 'Attachments' ? 'hidden' : 'space-y-4'}>
        <>

            {/* Upload panel — DC/Admin only */}
            {isDocumentController && (
              <Card>
                <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Upload className="h-4 w-4 text-sanpc-navy" /> Add Attachment
                </h2>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Label (e.g. Signed PDF, Board Resolution, Word Master)"
                    value={attachLabel}
                    onChange={(e) => setAttachLabel(e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sanpc-navy"
                  />
                  <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-md bg-sanpc-navy px-4 py-2 text-sm font-semibold text-white hover:bg-sanpc-navy/90 transition-colors">
                    <Upload className="h-4 w-4" />
                    {attachUploading ? 'Uploading…' : 'Choose File'}
                    <input
                      ref={attachInputRef}
                      type="file"
                      className="hidden"
                      disabled={attachUploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleAttachUpload(f)
                      }}
                    />
                  </label>
                </div>
                {attachError && (
                  <p className="mt-2 text-sm text-red-600">{attachError}</p>
                )}
              </Card>
            )}

            {/* Attachment list */}
            <Card>
              <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-sanpc-navy" />
                Attachments
                <span className="text-xs text-gray-400 font-normal">({attachments.length})</span>
              </h2>
              {attachments.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No attachments yet.</p>
              ) : (
                <div className="space-y-2">
                  {attachments.map((att) => {
                    const attExt = att.fileName.split('.').pop()?.toLowerCase() ?? ''
                    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(attExt)
                    const isPdf = attExt === 'pdf'
                    const isWord = attExt === 'docx' || attExt === 'doc'
                    const canPreview = isImage || isPdf || isWord
                    const isPreviewing = previewingAttach?.id === att.id
                    const fileUrl = `/api/documents/${doc.id}/attachments/${att.id}/file`
                    return (
                      <div key={att.id} className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
                        <div className="flex items-center gap-3 px-3 py-2">
                          <Paperclip className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{att.label || att.fileName}</p>
                            {att.label && <p className="text-xs text-gray-400 truncate">{att.fileName}</p>}
                            <p className="text-xs text-gray-400">
                              {formatBytes(att.fileSize)} · {new Date(att.createdAt).toLocaleDateString('en-ZA')} · {att.uploadedBy.name}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {canPreview && (
                              <button
                                type="button"
                                onClick={() => setPreviewingAttach(isPreviewing ? null : att)}
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
                                  isPreviewing
                                    ? 'border-sanpc-navy bg-sanpc-navy text-white'
                                    : 'border-gray-300 text-gray-600 hover:bg-white'
                                }`}
                              >
                                <Paperclip className="h-3.5 w-3.5" />
                                {isPreviewing ? 'Hide' : 'View'}
                              </button>
                            )}
                            <a
                              href={fileUrl}
                              download={att.fileName}
                              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-white transition-colors"
                            >
                              <Download className="h-3.5 w-3.5" /> Download
                            </a>
                            {isDocumentController && (
                              <button
                                type="button"
                                onClick={() => { handleAttachDelete(att.id); if (isPreviewing) setPreviewingAttach(null) }}
                                className="rounded-md p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Remove attachment"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inline viewer */}
                        {isPreviewing && (
                          <div className="border-t border-gray-200 bg-white">
                            {isImage ? (
                              <div className="p-4 flex justify-center bg-gray-50">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={fileUrl}
                                  alt={att.fileName}
                                  className="max-w-full max-h-[75vh] object-contain rounded shadow"
                                />
                              </div>
                            ) : isPdf ? (
                              <iframe
                                src={`/api/documents/${doc.id}/attachments/${att.id}/preview`}
                                className="w-full border-0"
                                style={{ height: '75vh' }}
                                title={att.fileName}
                              />
                            ) : (
                              <AttachmentDocxViewer
                                previewUrl={`/api/documents/${doc.id}/attachments/${att.id}/preview`}
                                fileName={att.fileName}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
        </>
      </div>

      {/* History — kept mounted (RV-3.12) */}
      <div className={activeTab !== 'History' ? 'hidden' : 'space-y-6'}>
        <Card>
          <h2 className="font-semibold text-gray-800 mb-4">Activity Log</h2>
          <ActivityLog activities={activities} />
        </Card>
        <Card>
          <h2 className="font-semibold text-gray-800 mb-4">Revision History</h2>
          <VersionHistory documentId={doc.id} currentVersion={doc.version} versions={doc.versions} />
        </Card>
      </div>
    </div>
  )
}
