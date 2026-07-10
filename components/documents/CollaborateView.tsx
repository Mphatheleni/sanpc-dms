'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, CheckCircle, XCircle, Clock, Send, Download,
  Users, MessageSquare, FileText, AlertTriangle, RefreshCw,
  Info, Wifi, WifiOff,
} from 'lucide-react'
import DocumentViewer from './DocumentViewer'
import CommentThread from './CommentThread'
import StatusBadge from './StatusBadge'
import { isReviewOverdue, getDeadlineLabel } from '@/lib/sla'
import { Textarea } from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import type { Document, SessionUser, DocumentComment } from '@/types'

/* ── helpers ──────────────────────────────────────────────────── */
function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

function formatDate(date: string) {
  return new Date(date).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const AVATAR_COLORS = ['#1C3557', '#7C3AED', '#16A34A', '#D97706', '#DC2626', '#0891B2']

/* ── presence dot ─────────────────────────────────────────────── */
function PresenceDot({ name, color, isYou = false }: { name: string; color: string; isYou?: boolean }) {
  return (
    <div className="relative group flex-shrink-0">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-white"
        style={{ backgroundColor: color }}
        title={isYou ? `${name} (you)` : name}
      >
        {initials(name)}
      </div>
      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-400" />
      {/* tooltip */}
      <div className="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 z-50">
        {isYou ? `${name} (you)` : name}
      </div>
    </div>
  )
}

/* ── mock SharePoint header ────────────────────────────────────── */
function SharePointHeader({
  doc,
  presence,
  isMock,
}: {
  doc: Document
  presence: { name: string; color: string; isYou?: boolean }[]
  isMock: boolean
}) {
  return (
    <header className="flex-shrink-0 border-b border-gray-200 bg-white shadow-sm">
      {/* Mock notice banner */}
      {isMock && (
        <div className="flex items-center justify-center gap-2 bg-amber-50 border-b border-amber-200 px-4 py-1.5">
          <Info className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700 font-medium">
            Mock collaborative view — simulating SharePoint Online experience. Document actions are live.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 px-4 py-2">
        {/* M365 waffle + SharePoint branding */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Waffle icon (simplified) */}
          <div className="grid grid-cols-3 gap-0.5 h-6 w-6 flex-shrink-0">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="rounded-[1px]" style={{ backgroundColor: '#0078D4' }} />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold" style={{ color: '#0078D4' }}>SharePoint</span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-gray-300 flex-shrink-0" />

        {/* Breadcrumb */}
        <div className="hidden md:flex items-center gap-1 text-xs text-gray-500 min-w-0">
          <span className="hover:underline cursor-pointer">SANPC</span>
          <span>/</span>
          <span className="hover:underline cursor-pointer">Documents</span>
          <span>/</span>
          <span className="font-medium text-gray-700 truncate max-w-[200px]">{doc.title}</span>
        </div>

        <div className="flex-1" />

        {/* Presence indicators */}
        <div className="flex items-center gap-1">
          <div className="flex -space-x-2 mr-2">
            {presence.slice(0, 5).map((p, i) => (
              <PresenceDot key={i} name={p.name} color={p.color} isYou={p.isYou} />
            ))}
            {presence.length > 5 && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600 ring-2 ring-white">
                +{presence.length - 5}
              </div>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-1 text-xs text-green-600 font-medium">
            <Wifi className="h-3.5 w-3.5" />
            <span>{presence.length} viewing</span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-gray-300 flex-shrink-0 ml-2" />

        {/* Version + status */}
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-400">v{doc.version}</span>
          <StatusBadge status={doc.status} />
        </div>

        {/* Download */}
        <a
          href={`/api/documents/${doc.id}/file`}
          download={doc.fileName}
          className="ml-2 flex-shrink-0 flex items-center gap-1 rounded px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Download</span>
        </a>

        {/* Back link */}
        <Link
          href={`/documents/${doc.id}`}
          className="ml-1 flex-shrink-0 flex items-center gap-1 rounded px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Back to DMS</span>
        </Link>
      </div>
    </header>
  )
}

/* ── action panel (sidebar) ────────────────────────────────────── */
type Tab = 'actions' | 'comments'

function ActionSidebar({
  doc,
  session,
  onDocUpdate,
  comments,
  onCommentAdded,
}: {
  doc: Document
  session: SessionUser
  onDocUpdate: (d: Document) => void
  comments: DocumentComment[]
  onCommentAdded: (c: DocumentComment) => void
}) {
  const [tab, setTab] = useState<Tab>('actions')
  const [actionComments, setActionComments] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const isReviewerRole = session.role === 'REVIEWER' || session.role === 'ADMIN'
  const isApproverRole = session.role === 'APPROVER' || session.role === 'ADMIN'
  const isUploader = doc.uploadedById === session.userId || session.role === 'ADMIN'

  const myActiveReview = doc.reviews.find(
    (r) => !r.isApprover && r.reviewerId === session.userId && r.status === 'IN_PROGRESS'
  )
  const myActiveApproval = doc.reviews.find(
    (r) => r.isApprover && r.reviewerId === session.userId && r.status === 'IN_PROGRESS'
  )

  const canReview  = isReviewerRole && !!myActiveReview   && doc.status === 'IN_REVIEW'
  const canApprove = isApproverRole && !!myActiveApproval && doc.status === 'PENDING_APPROVAL'
  const canSubmit  = isUploader && ['DRAFT', 'CHANGES_REQUESTED', 'REJECTED'].includes(doc.status) && doc.reviews.length > 0
  const canAdvance = isUploader && doc.status === 'REVIEW_COMPLETE'

  const activeEntry = myActiveReview ?? myActiveApproval
  const overdue = isReviewOverdue(activeEntry?.startedAt ?? null, activeEntry?.deadline ?? null)
  const deadlineLabel = getDeadlineLabel(activeEntry?.deadline ?? null)

  async function act(endpoint: string, decision: string) {
    setLoading(decision); setError(null)
    try {
      const res = await fetch(`/api/documents/${doc.id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, comments: actionComments }),
      })
      if (res.ok) {
        onDocUpdate(await res.json())
        setActionComments('')
        setDone(true)
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error || `Error ${res.status}`)
      }
    } finally {
      setLoading(null)
    }
  }

  async function actNoBody(endpoint: string) {
    setLoading(endpoint); setError(null)
    try {
      const res = await fetch(`/api/documents/${doc.id}/${endpoint}`, { method: 'POST' })
      if (res.ok) { onDocUpdate(await res.json()); setDone(true) }
      else { const d = await res.json().catch(() => ({})); setError(d.error || `Error ${res.status}`) }
    } finally { setLoading(null) }
  }

  const hasAction = canReview || canApprove || canSubmit || canAdvance

  return (
    <aside className="flex w-80 flex-shrink-0 flex-col border-l border-gray-200 bg-white overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTab('actions')}
          className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
            tab === 'actions'
              ? 'border-b-2 text-[#1C3557]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          style={tab === 'actions' ? { borderColor: '#1C3557' } : {}}
        >
          <ClipboardCheck className="h-3.5 w-3.5" />
          Actions
          {hasAction && (
            <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: '#F5A623' }}>
              1
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('comments')}
          className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
            tab === 'comments'
              ? 'border-b-2 text-[#1C3557]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          style={tab === 'comments' ? { borderColor: '#1C3557' } : {}}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Comments
          {comments.length > 0 && (
            <span className="ml-0.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold text-gray-600">
              {comments.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── ACTIONS TAB ── */}
        {tab === 'actions' && (
          <div className="p-4 space-y-4">
            {/* Document info */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm font-semibold text-gray-800 truncate">{doc.title}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Version {doc.version}</span>
                <StatusBadge status={doc.status} />
              </div>
              <div className="text-xs text-gray-400">
                Uploaded by {doc.uploadedBy?.name}
              </div>
              {/* One-document note */}
              <div className="flex items-start gap-1.5 rounded bg-blue-50 border border-blue-100 px-2 py-1.5">
                <Users className="h-3.5 w-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-700 leading-tight">
                  Everyone accesses the <strong>same document</strong>. No copies — all annotations and changes are shared.
                </p>
              </div>
            </div>

            {/* Already actioned */}
            {done && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Action submitted</p>
                  <p className="text-xs text-green-600">Your decision has been recorded.</p>
                </div>
              </div>
            )}

            {/* Reviewer action */}
            {!done && canReview && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-lg bg-[#E8EDF4] border border-[#1C3557]/20 p-3">
                  <Clock className={`h-4 w-4 flex-shrink-0 mt-0.5 ${overdue ? 'text-red-500' : 'text-[#1C3557]'}`} />
                  <div>
                    <p className="text-sm font-semibold text-[#1C3557]">Review requested</p>
                    {deadlineLabel && (
                      <p className={`text-xs mt-0.5 ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        {overdue ? '⚠ Overdue — ' : ''}{deadlineLabel}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 border border-gray-100">
                  Review the document above. Add your notes below, then mark complete.
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Notes (optional)</label>
                  <Textarea
                    value={actionComments}
                    onChange={(e) => setActionComments(e.target.value)}
                    placeholder="Any observations or notes for the manager…"
                    rows={3}
                  />
                </div>
                {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
                <Button
                  loading={loading === 'APPROVED'}
                  onClick={() => act('review', 'APPROVED')}
                  className="w-full"
                  style={{ backgroundColor: '#16A34A', color: 'white' }}
                >
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                  Mark Review Complete
                </Button>
              </div>
            )}

            {/* Approver action */}
            {!done && canApprove && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <AlertTriangle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${overdue ? 'text-red-500' : 'text-amber-500'}`} />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Final approval required</p>
                    {deadlineLabel && (
                      <p className={`text-xs mt-0.5 ${overdue ? 'text-red-600 font-medium' : 'text-amber-600'}`}>
                        {overdue ? '⚠ Overdue — ' : ''}{deadlineLabel}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 border border-gray-100">
                  This is a <strong>final decision</strong>. Rejection will return the document to the manager for revision.
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Decision notes (optional)</label>
                  <Textarea
                    value={actionComments}
                    onChange={(e) => setActionComments(e.target.value)}
                    placeholder="Reason for approval or rejection…"
                    rows={3}
                  />
                </div>
                {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    loading={loading === 'APPROVED'}
                    onClick={() => act('approve', 'APPROVED')}
                    style={{ backgroundColor: '#16A34A', color: 'white' }}
                    className="w-full"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    loading={loading === 'REJECTED'}
                    onClick={() => act('approve', 'REJECTED')}
                    style={{ backgroundColor: '#DC2626', color: 'white' }}
                    className="w-full"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            )}

            {/* Manager: submit for review */}
            {!done && canSubmit && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-lg bg-gray-50 border border-gray-200 p-3">
                  <FileText className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Ready to submit?</p>
                    <p className="text-xs text-gray-500 mt-0.5">Reviewers will be notified by email with a link to this page.</p>
                  </div>
                </div>
                {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
                <Button
                  loading={loading === 'submit'}
                  onClick={() => actNoBody('submit')}
                  className="w-full"
                  style={{ backgroundColor: '#1C3557', color: 'white' }}
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  Submit for Review
                </Button>
              </div>
            )}

            {/* Manager: advance to approval */}
            {!done && canAdvance && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 p-3">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">All reviews complete</p>
                    <p className="text-xs text-green-600 mt-0.5">Advance to final approval stage.</p>
                  </div>
                </div>
                {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
                <Button
                  loading={loading === 'advance'}
                  onClick={() => actNoBody('advance')}
                  className="w-full"
                  style={{ backgroundColor: '#1C3557', color: 'white' }}
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Advance to Approval
                </Button>
              </div>
            )}

            {/* No action available */}
            {!done && !hasAction && (
              <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400 space-y-2">
                <WifiOff className="h-8 w-8 opacity-40" />
                <p className="text-sm">No actions available for your role at this stage.</p>
                <p className="text-xs">Status: <span className="font-medium">{doc.status.replace(/_/g, ' ')}</span></p>
              </div>
            )}

            {/* Workflow progress */}
            {doc.reviews.length > 0 && (
              <div className="border-t border-gray-100 pt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Workflow</p>
                {doc.reviews.map((r) => {
                  const statusColor =
                    r.status === 'APPROVED' ? '#16A34A' :
                    r.status === 'REJECTED' ? '#DC2626' :
                    r.status === 'IN_PROGRESS' ? '#1C3557' : '#9CA3AF'
                  const statusIcon =
                    r.status === 'APPROVED' ? '✓' :
                    r.status === 'REJECTED' ? '✕' :
                    r.status === 'IN_PROGRESS' ? '●' : '○'
                  return (
                    <div key={r.id} className="flex items-center gap-2">
                      <span className="text-xs font-bold w-4 flex-shrink-0" style={{ color: statusColor }}>{statusIcon}</span>
                      <div
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: AVATAR_COLORS[doc.reviews.indexOf(r) % AVATAR_COLORS.length] }}
                      >
                        {initials(r.reviewer.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-700 truncate">{r.reviewer.name}</p>
                        <p className="text-[10px] text-gray-400">{r.isApprover ? 'Approver' : 'Reviewer'}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── COMMENTS TAB ── */}
        {tab === 'comments' && (
          <div className="p-4">
            <CommentThread
              documentId={doc.id}
              comments={comments}
              onCommentAdded={onCommentAdded}
            />
          </div>
        )}
      </div>
    </aside>
  )
}

// Missing import — add inline
function ClipboardCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1" ry="1"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  )
}

/* ── main component ────────────────────────────────────────────── */
export default function CollaborateView({
  initialDoc,
  session,
}: {
  initialDoc: Document
  session: SessionUser
}) {
  const [doc, setDoc] = useState<Document>(initialDoc)
  const [comments, setComments] = useState<DocumentComment[]>(initialDoc.comments)

  function handleDocUpdate(updated: Document) {
    setDoc({ ...updated, versions: doc.versions, activities: doc.activities })
  }

  function handleCommentAdded(comment: DocumentComment) {
    setComments((prev) => [...prev, comment])
  }

  // Build presence list: current user + active reviewers/approvers
  const activeReviewers = doc.reviews
    .filter((r) => r.status === 'IN_PROGRESS')
    .map((r, i) => ({
      name: r.reviewer.name,
      color: AVATAR_COLORS[(i + 1) % AVATAR_COLORS.length],
      isYou: r.reviewerId === session.userId,
    }))

  // Always show current user if not already in the list
  const alreadyPresent = activeReviewers.some((p) => p.isYou)
  const presence = [
    ...(alreadyPresent ? [] : [{
      name: session.name,
      color: '#1C3557',
      isYou: true,
    }]),
    ...activeReviewers.map((r) => ({
      ...r,
      isYou: r.name === session.name || r.isYou,
    })),
    // mock: uploader also present
    ...(doc.uploadedBy && doc.uploadedBy.id !== session.userId ? [{
      name: doc.uploadedBy.name,
      color: '#0891B2',
      isYou: false,
    }] : []),
  ]

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-100">
      <SharePointHeader doc={doc} presence={presence} isMock={!doc.sharePointUrl} />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Document viewer */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl">
            {/* Doc title in "Office Online" style */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: '#D83B01' }}>
                {/* Word-style icon */}
                <span className="text-white font-bold text-sm">W</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-800">{doc.fileName}</h1>
                <p className="text-xs text-gray-400">
                  {doc.category && <>{doc.category} · </>}
                  {(doc.fileSize / 1024).toFixed(1)} KB ·
                  Shared with {doc.reviews.length} people
                </p>
              </div>
              {doc.sharePointUrl ? (
                <a
                  href={doc.sharePointUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
                  style={{ backgroundColor: '#0078D4' }}
                >
                  Open in Office Online ↗
                </a>
              ) : (
                <div className="ml-auto flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 bg-white px-3 py-1.5">
                  <span className="text-xs text-gray-400">Office Online link not configured</span>
                </div>
              )}
            </div>

            {/* The actual document */}
            <DocumentViewer
              documentId={doc.id}
              fileName={doc.fileName}
              fileType={doc.fileType}
            />

            {/* Mock annotation hints */}
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800">Collaborative annotations</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  In production, this opens the real document in Microsoft Office Online where all reviewers
                  can annotate, comment, and track changes simultaneously — all on the <strong>one shared file</strong>.
                  Use the action panel on the right to submit your review decision.
                </p>
              </div>
            </div>
          </div>
        </main>

        {/* DMS action sidebar */}
        <ActionSidebar
          doc={doc}
          session={session}
          onDocUpdate={handleDocUpdate}
          comments={comments}
          onCommentAdded={handleCommentAdded}
        />
      </div>
    </div>
  )
}
