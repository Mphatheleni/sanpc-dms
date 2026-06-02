'use client'

import { useState } from 'react'
import {
  CheckCircle, XCircle, RefreshCw, ExternalLink,
  FileEdit, ClipboardCheck, AlertTriangle, Clock, Send,
} from 'lucide-react'
// XCircle and RefreshCw used by approver buttons only
import Button from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { getDeadlineLabel, isReviewOverdue } from '@/lib/sla'
import type { Document, SessionUser } from '@/types'

interface ReviewPanelProps {
  document: Document
  session: SessionUser
  onUpdate: (doc: Document) => void
}

export default function ReviewPanel({ document, session, onUpdate }: ReviewPanelProps) {
  const [comments, setComments] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isReviewerRole = session.role === 'REVIEWER' || session.role === 'ADMIN'
  const isApproverRole = session.role === 'APPROVER' || session.role === 'ADMIN'
  const isUploader    = document.uploadedById === session.userId || session.role === 'ADMIN'

  const myActiveReview = document.reviews.find(
    (r) => !r.isApprover && r.reviewerId === session.userId && r.status === 'IN_PROGRESS'
  )
  const myActiveApproval = document.reviews.find(
    (r) => r.isApprover && r.reviewerId === session.userId && r.status === 'IN_PROGRESS'
  )

  const canReview  = isReviewerRole && !!myActiveReview   && document.status === 'IN_REVIEW'
  const canApprove = isApproverRole && !!myActiveApproval && document.status === 'PENDING_APPROVAL'
  const canSubmit  =
    isUploader &&
    (document.status === 'DRAFT' || document.status === 'CHANGES_REQUESTED' || document.status === 'REJECTED') &&
    document.reviews.length > 0
  const canAdvance = isUploader && document.status === 'REVIEW_COMPLETE'

  const activeEntry = myActiveReview ?? myActiveApproval
  const deadline    = activeEntry?.deadline ?? null
  const overdue     = isReviewOverdue(activeEntry?.startedAt ?? null, deadline)
  const deadlineLabel = getDeadlineLabel(deadline)
  const isApproverAction = canApprove && !canReview

  async function submitReview(decision: string) {
    setLoading(decision); setError(null)
    try {
      const res = await fetch(`/api/documents/${document.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, comments }),
      })
      if (res.ok) { onUpdate(await res.json()); setComments('') }
      else { const d = await res.json().catch(() => ({})); setError(d.error || `Error ${res.status}`) }
    } finally { setLoading(null) }
  }

  async function submitApproval(decision: string) {
    setLoading(decision); setError(null)
    try {
      const res = await fetch(`/api/documents/${document.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, comments }),
      })
      if (res.ok) { onUpdate(await res.json()); setComments('') }
      else { const d = await res.json().catch(() => ({})); setError(d.error || `Error ${res.status}`) }
    } finally { setLoading(null) }
  }

  async function submitForReview() {
    setLoading('submit'); setError(null)
    try {
      const res = await fetch(`/api/documents/${document.id}/submit`, { method: 'POST' })
      if (res.ok) { onUpdate(await res.json()) }
      else { const d = await res.json().catch(() => ({})); setError(d.error || `Error ${res.status}`) }
    } finally { setLoading(null) }
  }

  async function advanceToApproval() {
    setLoading('advance'); setError(null)
    try {
      const res = await fetch(`/api/documents/${document.id}/advance`, { method: 'POST' })
      if (res.ok) { onUpdate(await res.json()) }
      else { const d = await res.json().catch(() => ({})); setError(d.error || `Error ${res.status}`) }
    } finally { setLoading(null) }
  }

  // ── Review complete: back with doc manager ───────────────────────────────────
  if (canAdvance) {
    return (
      <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: '#1C3557' }}>
        <div className="px-5 py-3 flex items-center gap-2" style={{ backgroundColor: '#1C3557' }}>
          <ClipboardCheck className="h-5 w-5 text-white" />
          <span className="font-bold text-white text-sm">All Reviews Complete — Action Required</span>
        </div>
        <div className="p-5 bg-white space-y-4">
          <p className="text-sm text-gray-600">
            All reviewers have approved this document. It is now back with you to make any final edits or clean-ups
            before sending it for formal approval.
          </p>
          {document.sharePointUrl && (
            <a
              href={document.sharePointUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white"
              style={{ backgroundColor: '#0078D4' }}
            >
              <ExternalLink className="h-4 w-4" />
              Open in Office Online to review annotations
            </a>
          )}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">When ready, send for approval:</p>
            <Button onClick={advanceToApproval} loading={loading === 'advance'}>
              <Send className="h-4 w-4" />
              Send for Approval
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Document Manager: submit panel ──────────────────────────────────────────
  if (canSubmit) {
    return (
      <div className="rounded-xl border-2 p-5 space-y-3" style={{ borderColor: '#F5A623', backgroundColor: '#FFFBEB' }}>
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" style={{ color: '#F5A623' }} />
          <h3 className="font-bold text-gray-800">
            {document.status === 'DRAFT' ? 'Ready to submit for review?' : 'Document returned — resubmit when ready'}
          </h3>
        </div>
        {document.status !== 'DRAFT' && (
          <p className="text-sm text-gray-600">
            This document was <strong>{document.status === 'REJECTED' ? 'rejected' : 'returned for changes'}</strong>.
            Update the document if needed, then resubmit to restart the review workflow.
          </p>
        )}
        <Button onClick={submitForReview} loading={loading === 'submit'} className="mt-1">
          {document.status === 'DRAFT' ? 'Submit for Review' : 'Resubmit for Review'}
        </Button>
      </div>
    )
  }

  if (!canReview && !canApprove) return null

  // ── Reviewer / Approver: two-step action panel ───────────────────────────────
  return (
    <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: '#1C3557' }}>

      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between" style={{ backgroundColor: '#1C3557' }}>
        <div className="flex items-center gap-2">
          <FileEdit className="h-5 w-5 text-white" />
          <span className="font-bold text-white text-sm">
            {isApproverAction ? 'Your Approval is Required' : 'Your Review is Required'}
          </span>
        </div>
        {deadlineLabel && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
            overdue ? 'bg-red-500 text-white' : 'bg-amber-400 text-gray-900'
          }`}>
            {overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {deadlineLabel}
          </span>
        )}
      </div>

      <div className="p-5 space-y-5 bg-white">

        {/* Step 1 — Open in SharePoint (shown when SharePoint URL exists) */}
        {document.sharePointUrl && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">1</div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800 text-sm">Open &amp; annotate in Office Online</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Read the document carefully. Use <strong>Word comments</strong> or <strong>Track Changes</strong> to annotate inline.
                  All collaborators see your changes in real time.
                </p>
                <a
                  href={document.sharePointUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: '#0078D4' }}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.5 2C9.46 2 7 4.46 7 7.5c0 .95.25 1.84.68 2.61L3 14.5V20h5.5l4.32-4.32c.47.2.98.32 1.5.32 2.76 0 5-2.24 5-5S15.76 2 12.5 2zm0 8c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3z"/>
                  </svg>
                  Open in Office Online
                  <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Formal decision */}
        <div className="rounded-lg border border-gray-200 p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white text-xs font-bold"
              style={{ backgroundColor: '#1C3557' }}
            >
              {document.sharePointUrl ? '2' : '1'}
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">Submit your formal decision</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {isApproverAction
                  ? 'Your decision is final. Approve to publish this document, or reject to return it.'
                  : 'After reviewing, record your decision below. This is logged in the audit trail.'}
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <Textarea
            label="Decision comments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            placeholder={
              isApproverAction
                ? 'Add approval notes or reason for rejection…'
                : 'Summarise your findings, issues found, or reason for your decision…'
            }
          />

          {/* Decision buttons */}
          <div>
            {canReview && (
              <div className="space-y-3">
                <button
                  onClick={() => submitReview('APPROVED')}
                  disabled={!!loading}
                  className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white transition-all disabled:opacity-60 hover:opacity-90"
                  style={{ backgroundColor: '#1C3557' }}
                >
                  <CheckCircle className="h-4 w-4" />
                  {loading === 'APPROVED' ? 'Submitting…' : 'Mark as Complete'}
                </button>
                <p className="text-[11px] text-gray-400">
                  Add your annotations and comments in Office Online first, then mark your review as complete here.
                </p>
              </div>
            )}

            {canApprove && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => submitApproval('APPROVED')}
                    disabled={!!loading}
                    className="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold text-white transition-all disabled:opacity-60 hover:opacity-90"
                    style={{ backgroundColor: '#16A34A' }}
                  >
                    <CheckCircle className="h-4 w-4" />
                    {loading === 'APPROVED' ? 'Approving…' : 'Final Approve'}
                  </button>
                  <button
                    onClick={() => submitApproval('REJECTED')}
                    disabled={!!loading}
                    className="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold text-white transition-all disabled:opacity-60 bg-red-600 hover:bg-red-700"
                  >
                    <XCircle className="h-4 w-4" />
                    {loading === 'REJECTED' ? 'Rejecting…' : 'Reject'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400">
                  <strong>Final Approve</strong> — marks document as officially approved &nbsp;·&nbsp;
                  <strong>Reject</strong> — returns document to manager
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
