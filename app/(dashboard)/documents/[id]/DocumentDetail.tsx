'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Download, FileText, User, Calendar, Tag, Layers,
  CheckCircle, Clock, XCircle, AlertTriangle, UserCheck, X,
  ShieldCheck, FileSignature, Landmark, Archive,
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
import type { Document, SessionUser, DocumentComment, DocumentActivity } from '@/types'

function formatDate(date: string) {
  return new Date(date).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const reviewStatusIcon: Record<string, React.ReactNode> = {
  PENDING:           <Clock className="h-4 w-4 text-gray-400" />,
  IN_PROGRESS:       <Clock className="h-4 w-4 text-sanpc-navy" />,
  APPROVED:          <CheckCircle className="h-4 w-4 text-green-500" />,
  REJECTED:          <XCircle className="h-4 w-4 text-red-500" />,
  CHANGES_REQUESTED: <XCircle className="h-4 w-4 text-yellow-500" />,
}

const TABS = ['Overview', 'Reviewer Comments', 'Workflow', 'History'] as const
type Tab = typeof TABS[number]

interface UserOption { id: string; name: string; email: string; role: string }
interface Props { initialDoc: Document; session: SessionUser; users?: UserOption[] }

export default function DocumentDetail({ initialDoc, session, users = [] }: Props) {
  const [doc, setDoc] = useState<Document>(initialDoc)
  const [comments, setComments] = useState<DocumentComment[]>(initialDoc.comments)
  const [activities, setActivities] = useState<DocumentActivity[]>(initialDoc.activities)
  const [replaceTarget, setReplaceTarget] = useState<{ reviewId: string; isApprover: boolean } | null>(null)
  const [replaceUserId, setReplaceUserId] = useState('')
  const [replacing, setReplacing] = useState(false)
  const [addTarget, setAddTarget] = useState<{ isApprover: boolean } | null>(null)
  const [addUserId, setAddUserId] = useState('')
  const [adding, setAdding] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('Overview')

  const canManage =
    session.role === 'ADMIN' ||
    session.role === 'DOCUMENT_MANAGER' ||
    doc.uploadedById === session.userId

  async function handleReplaceReviewer() {
    if (!replaceTarget || !replaceUserId) return
    setReplacing(true)
    try {
      const res = await fetch(`/api/documents/${doc.id}/replace-reviewer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: replaceTarget.reviewId, newReviewerId: replaceUserId }),
      })
      if (res.ok) {
        const updated = await res.json()
        setDoc({ ...updated, versions: doc.versions, activities: doc.activities })
        setReplaceTarget(null)
        setReplaceUserId('')
      }
    } finally {
      setReplacing(false)
    }
  }

  async function handleAddReviewer() {
    if (!addTarget || !addUserId) return
    setAdding(true)
    try {
      const res = await fetch(`/api/documents/${doc.id}/add-reviewer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newReviewerId: addUserId, isApprover: addTarget.isApprover }),
      })
      if (res.ok) {
        const updated = await res.json()
        setDoc({ ...updated, versions: doc.versions, activities: doc.activities })
        setAddTarget(null)
        setAddUserId('')
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
    const approved = reviews.filter((r) => r.status === 'APPROVED').length
    const active = reviews.filter((r) => r.status === 'IN_PROGRESS').length
    const total = reviews.length
    const allDone = approved === total
    const anyActive = active > 0

    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            allDone ? 'bg-green-100 text-green-700' :
            anyActive ? 'bg-sanpc-navy-light text-sanpc-navy' :
            'bg-gray-100 text-gray-500'
          }`}>
            {approved}/{total} {isApproverGroup ? 'approved' : 'completed'}
          </span>
        </div>
        {anyActive && !allDone && (
          <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            All {label.toLowerCase()} notified simultaneously
          </p>
        )}
        <div className="space-y-2">
          {reviews.map((review, i) => {
            const overdue = isReviewOverdue(review.startedAt, review.deadline)
            const deadlineLabel = getDeadlineLabel(review.deadline)
            const isActive = review.status === 'IN_PROGRESS'
            const isModifiable = review.status === 'IN_PROGRESS' || review.status === 'PENDING'
            return (
              <div
                key={review.id}
                className={`rounded-lg border transition-colors ${
                  isActive ? 'border-sanpc-navy bg-sanpc-navy-light' :
                  review.status === 'APPROVED' ? 'border-green-200 bg-green-50' :
                  review.status === 'REJECTED' || review.status === 'CHANGES_REQUESTED' ? 'border-red-200 bg-red-50' :
                  'border-gray-100 bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3 p-3">
                  <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    review.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                    isActive ? 'bg-white text-sanpc-navy' :
                    review.status === 'REJECTED' || review.status === 'CHANGES_REQUESTED' ? 'bg-red-100 text-red-700' :
                    'bg-white text-gray-400'
                  }`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {reviewStatusIcon[review.status]}
                        <span className="text-sm font-medium text-gray-800">{review.reviewer.name}</span>
                        {review.isMandatory && review.mandatoryRole && (
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
                        {!isApproverGroup && review.status === 'APPROVED'
                          ? <Badge variant="success">Completed</Badge>
                          : <StatusBadge status={review.status} />
                        }
                        {canManage && isModifiable && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (replaceTarget?.reviewId === review.id) {
                                  setReplaceTarget(null); setReplaceUserId('')
                                } else {
                                  setReplaceTarget({ reviewId: review.id, isApprover: isApproverGroup })
                                  setReplaceUserId('')
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
                    {review.reviewedAt && <p className="text-xs text-gray-400 mt-0.5">{formatDate(review.reviewedAt)}</p>}
                  </div>
                </div>

                {replaceTarget?.reviewId === review.id && (() => {
                  const alreadyAssigned = new Set(doc.reviews.map((r) => r.reviewerId))
                  const pool = users.filter((u) => {
                    const roleOk = isApproverGroup
                      ? u.role === 'APPROVER' || u.role === 'ADMIN'
                      : u.role === 'REVIEWER' || u.role === 'ADMIN' || u.role === 'DOCUMENT_MANAGER'
                    return roleOk && !alreadyAssigned.has(u.id)
                  })
                  return (
                    <div className="border-t border-amber-200 bg-amber-50 px-3 py-3 flex items-center gap-2 flex-wrap">
                      <UserCheck className="h-4 w-4 text-amber-600 flex-shrink-0" />
                      <span className="text-xs font-semibold text-amber-800">Replace with:</span>
                      <select
                        value={replaceUserId}
                        onChange={(e) => setReplaceUserId(e.target.value)}
                        className="flex-1 min-w-[180px] rounded-md border border-amber-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                      >
                        <option value="">— Select replacement —</option>
                        {pool.map((u) => (
                          <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleReplaceReviewer}
                        disabled={!replaceUserId || replacing}
                        className="rounded-md px-3 py-1 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {replacing ? 'Replacing…' : 'Confirm'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setReplaceTarget(null); setReplaceUserId('') }}
                        className="rounded-md p-1 text-amber-600 hover:bg-amber-100 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )
                })()}

                {/* S10: Remove confirmation */}
                {removeTarget === review.id && (
                  <div className="border-t border-red-200 bg-red-50 px-3 py-3 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-red-800 flex-1">Remove {review.reviewer.name} from workflow?</span>
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

        {/* S9: Add reviewer/approver panel */}
        {canManage && (
          <div className="mt-3">
            {addTarget?.isApprover === isApproverGroup ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 flex items-center gap-2 flex-wrap">
                <UserCheck className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-amber-800">Add {isApproverGroup ? 'approver' : 'reviewer'}:</span>
                <select
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value)}
                  className="flex-1 min-w-[180px] rounded-md border border-amber-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  <option value="">— Select person —</option>
                  {users
                    .filter((u) => {
                      const roleOk = isApproverGroup
                        ? u.role === 'APPROVER' || u.role === 'ADMIN'
                        : u.role === 'REVIEWER' || u.role === 'ADMIN' || u.role === 'DOCUMENT_MANAGER'
                      return roleOk && !doc.reviews.some((r) => r.reviewerId === u.id)
                    })
                    .map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))
                  }
                </select>
                <button
                  type="button"
                  onClick={handleAddReviewer}
                  disabled={!addUserId || adding}
                  className="rounded-md px-3 py-1 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  {adding ? 'Adding…' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => { setAddTarget(null); setAddUserId('') }}
                  className="rounded-md p-1 text-amber-600 hover:bg-amber-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setAddTarget({ isApprover: isApproverGroup }); setReplaceTarget(null); setRemoveTarget(null) }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                + Add {isApproverGroup ? 'approver' : 'reviewer'}
              </button>
            )}
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
              <Badge variant="secondary" className="flex-shrink-0">v{doc.version}</Badge>
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
            <a
              href={`/api/documents/${doc.id}/file`}
              download={doc.fileName}
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
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DocumentViewer documentId={doc.id} fileName={doc.fileName} fileType={doc.fileType} />
          </div>
          <div className="space-y-4">
            {(doc.purpose || doc.description) && (
              <Card>
                {doc.purpose && (
                  <div className="mb-2">
                    <h2 className="font-semibold text-gray-800 mb-1">Purpose</h2>
                    <p className="text-sm text-gray-600 italic">{doc.purpose}</p>
                  </div>
                )}
                {doc.description && (
                  <div>
                    <h2 className="font-semibold text-gray-800 mb-1">Description</h2>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{doc.description}</p>
                  </div>
                )}
                {!doc.purpose && !doc.description && (
                  <p className="text-sm text-gray-400">No description provided.</p>
                )}
              </Card>
            )}
            {!doc.purpose && !doc.description && (
              <Card>
                <h2 className="font-semibold text-gray-800 mb-3">Description</h2>
                <p className="text-sm text-gray-400">No description provided.</p>
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
                      <dt className="text-xs text-gray-500">Authorised By</dt>
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

      {/* Workflow */}
      {activeTab === 'Workflow' && (
        <div className="space-y-6">
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
                    {/* S13: Originator row */}
                    {doc.originatorUser && (
                      <tr className="bg-gray-50/50">
                        <td className="py-2 pr-4 text-gray-400 text-xs">—</td>
                        <td className="py-2 pr-4 font-medium text-gray-800">{doc.originatorUser.name}</td>
                        <td className="py-2 pr-4 text-gray-500 text-xs">Originator</td>
                        <td className="py-2 pr-4">
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">—</span>
                        </td>
                        <td className="py-2 text-gray-400 text-xs">—</td>
                      </tr>
                    )}
                    {doc.reviews.map((r, i) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="py-2 pr-4 text-gray-400 text-xs">{i + 1}</td>
                        <td className="py-2 pr-4 font-medium text-gray-800">
                          {r.reviewer.name}
                          {r.isMandatory && r.mandatoryRole && (
                            <span className="ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-purple-100 text-purple-700 uppercase tracking-wide">
                              {r.mandatoryRole.replace('_', ' ')}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-gray-500 text-xs">{r.isApprover ? 'Approver' : 'Reviewer'}</td>
                        <td className="py-2 pr-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                            r.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                            r.status === 'REJECTED' || r.status === 'CHANGES_REQUESTED' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {r.status === 'APPROVED' && !r.isApprover ? 'Complete' : r.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2 text-gray-400 text-xs">
                          {r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString('en-ZA') : r.startedAt ? 'In progress' : '—'}
                        </td>
                      </tr>
                    ))}
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
      )}

      {/* Reviewer Comments */}
      {activeTab === 'Reviewer Comments' && (
        <Card>
          <h2 className="font-semibold text-gray-800 mb-4">Reviewer Comments</h2>
          <CommentThread documentId={doc.id} comments={comments} onCommentAdded={handleCommentAdded} />
        </Card>
      )}

      {/* History */}
      {activeTab === 'History' && (
        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold text-gray-800 mb-4">Activity Log</h2>
            <ActivityLog activities={activities} />
          </Card>
          <Card>
            <h2 className="font-semibold text-gray-800 mb-4">Version History</h2>
            <VersionHistory documentId={doc.id} currentVersion={doc.version} versions={doc.versions} />
          </Card>
        </div>
      )}
    </div>
  )
}
