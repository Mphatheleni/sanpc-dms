'use client'

import { useState, useRef } from 'react'
import {
  CheckCircle, XCircle,
  FileEdit, ClipboardCheck, AlertTriangle, Clock, Send, ShieldCheck, Archive, Ban,
  Upload, Landmark, FileSignature,
} from 'lucide-react'
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
  const [reviewDecision, setReviewDecision] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signFile, setSignFile] = useState<File | null>(null)
  const [excoFile, setExcoFile] = useState<File | null>(null)
  const [amendFile, setAmendFile] = useState<File | null>(null)
  const signRef = useRef<HTMLInputElement>(null)
  const excoRef = useRef<HTMLInputElement>(null)
  const amendRef = useRef<HTMLInputElement>(null)

  const isUploader    = document.uploadedById === session.userId || session.role === 'ADMIN'

  const myActiveReview = document.reviews.find(
    (r) => !r.isApprover && r.reviewerId === session.userId && r.status === 'IN_PROGRESS'
  )
  const myActiveApproval = document.reviews.find(
    (r) => r.isApprover && r.reviewerId === session.userId && r.status === 'IN_PROGRESS'
  )

  // Any user assigned an active review/approval can act on it — role gates are enforced at assignment time
  const canReview  = !!myActiveReview   && document.status === 'IN_REVIEW'
  const canApprove = !!myActiveApproval && (document.status === 'PENDING_APPROVAL' || document.status === 'FINAL_DRAFT')
  const canSubmit  =
    isUploader &&
    (document.status === 'REGISTERED' || document.status === 'DRAFT' || document.status === 'CHANGES_REQUESTED') &&
    document.reviews.length > 0
  const canResubmitForApproval = isUploader && document.status === 'REJECTED' && document.reviews.some((r) => r.isApprover)
  const canAdvance      = isUploader && (document.status === 'REVIEW_COMPLETE' || document.status === 'UPDATING')
  const canReplaceFile  = isUploader && ['IN_REVIEW', 'FINAL_DRAFT', 'PENDING_APPROVAL', 'REJECTED', 'CHANGES_REQUESTED'].includes(document.status)
  const canControl   = (session.role === 'ADMIN' || isUploader) && document.status === 'APPROVED' && document.documentTypeCode !== 'PO' && !document.isExcoRequired
  const canExco      = (session.role === 'ADMIN' || isUploader) && document.status === 'APPROVED' && (document.documentTypeCode === 'PO' || document.isExcoRequired)
  const canExcoCtrl  = (session.role === 'ADMIN' || isUploader) && document.status === 'EXCO_PENDING'
  const canSupersede = (session.role === 'ADMIN' || isUploader) && document.status === 'CONTROLLED'
  const canCancel    = (session.role === 'ADMIN' || isUploader) && !['CANCELLED', 'SUPERSEDED'].includes(document.status)
  const canSign      = (session.role === 'ADMIN' || isUploader) && ['APPROVED', 'EXCO_PENDING', 'CONTROLLED'].includes(document.status)

  const activeEntry   = myActiveReview ?? myActiveApproval
  const deadline      = activeEntry?.deadline ?? null
  const overdue       = isReviewOverdue(activeEntry?.startedAt ?? null, deadline)
  const deadlineLabel = getDeadlineLabel(deadline)
  const isApproverAction = canApprove && !canReview

  async function submitReview(decision: string, commentsOverride?: string) {
    setLoading(decision); setError(null)
    const body = commentsOverride ?? comments
    try {
      const res = await fetch(`/api/documents/${document.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, comments: body }),
      })
      if (res.ok) { onUpdate(await res.json()); setComments(''); setReviewDecision('') }
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

  async function uploadAmendedFile() {
    if (!amendFile) return
    setLoading('amend'); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', amendFile)
      const res = await fetch(`/api/documents/${document.id}/amend-file`, { method: 'POST', body: fd })
      if (res.ok) { onUpdate(await res.json()); setAmendFile(null) }
      else { const d = await res.json().catch(() => ({})); setError(d.error || `Error ${res.status}`) }
    } finally { setLoading(null) }
  }

  async function resubmitForApproval() {
    setLoading('resubmit'); setError(null)
    try {
      const res = await fetch(`/api/documents/${document.id}/resubmit-for-approval`, { method: 'POST' })
      if (res.ok) { onUpdate(await res.json()) }
      else { const d = await res.json().catch(() => ({})); setError(d.error || `Error ${res.status}`) }
    } finally { setLoading(null) }
  }

  async function controlDocument(action: 'CONTROLLED' | 'SUPERSEDED' | 'CANCELLED') {
    setLoading(action); setError(null)
    try {
      const res = await fetch(`/api/documents/${document.id}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comments }),
      })
      if (res.ok) { onUpdate(await res.json()); setComments('') }
      else { const d = await res.json().catch(() => ({})); setError(d.error || `Error ${res.status}`) }
    } finally { setLoading(null) }
  }

  async function submitForExco() {
    setLoading('SUBMIT_EXCO'); setError(null)
    try {
      const res = await fetch(`/api/documents/${document.id}/exco`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SUBMIT_EXCO' }),
      })
      if (res.ok) { onUpdate(await res.json()) }
      else { const d = await res.json().catch(() => ({})); setError(d.error || `Error ${res.status}`) }
    } finally { setLoading(null) }
  }

  async function uploadExcoResolution() {
    if (!excoFile) return
    setLoading('UPLOAD_RESOLUTION'); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', excoFile)
      const res = await fetch(`/api/documents/${document.id}/exco`, { method: 'POST', body: fd })
      if (res.ok) { onUpdate(await res.json()); setExcoFile(null) }
      else { const d = await res.json().catch(() => ({})); setError(d.error || `Error ${res.status}`) }
    } finally { setLoading(null) }
  }

  async function uploadSignedPage() {
    if (!signFile) return
    setLoading('SIGN_UPLOAD'); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', signFile)
      const res = await fetch(`/api/documents/${document.id}/sign`, { method: 'POST', body: fd })
      if (res.ok) { onUpdate(await res.json()); setSignFile(null) }
      else { const d = await res.json().catch(() => ({})); setError(d.error || `Error ${res.status}`) }
    } finally { setLoading(null) }
  }

  // ── Review complete / Updating: back with doc manager ────────────────────
  if (canAdvance) {
    return (
      <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: '#1C3557' }}>
        <div className="px-5 py-3 flex items-center gap-2" style={{ backgroundColor: '#1C3557' }}>
          <ClipboardCheck className="h-5 w-5 text-white" />
          <span className="font-bold text-white text-sm">All Reviews Complete — Action Required</span>
        </div>
        <div className="p-5 bg-white space-y-4">
          <p className="text-sm text-gray-600">
            All reviewers have approved this document. Obtain the final updated version from the Originator,
            upload it as a new version below, then send the Final Draft for approval.
          </p>
          {error && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

          {/* S15: Upload revised document from Originator */}
          <div className="rounded-lg border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Upload Revised Document (from Originator)</p>
            <div
              className="flex items-center gap-3 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-3 cursor-pointer hover:border-sanpc-navy transition-colors"
              onClick={() => amendRef.current?.click()}
            >
              <Upload className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-500">
                {amendFile ? amendFile.name : 'Click to select revised document'}
              </span>
            </div>
            <input
              ref={amendRef}
              type="file"
              className="hidden"
              onChange={(e) => setAmendFile(e.target.files?.[0] ?? null)}
            />
            {amendFile && (
              <Button onClick={uploadAmendedFile} loading={loading === 'amend'} variant="outline">
                <Upload className="h-4 w-4" />
                Upload New Version
              </Button>
            )}
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">When the final version is ready, send for approval:</p>
            <Button onClick={advanceToApproval} loading={loading === 'advance'}>
              <Send className="h-4 w-4" />
              Send Final Draft for Approval
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── REJECTED: replace file + send back for approval only ─────────────────
  if (canResubmitForApproval) {
    return (
      <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: '#DC2626' }}>
        <div className="px-5 py-3 flex items-center gap-2" style={{ backgroundColor: '#DC2626' }}>
          <XCircle className="h-5 w-5 text-white" />
          <span className="font-bold text-white text-sm">Document Rejected — Action Required</span>
        </div>
        <div className="p-5 bg-white space-y-4">
          <p className="text-sm text-gray-600">
            This document was rejected. Obtain the revised version from the Originator, upload it below,
            then send it directly for re-approval. <strong>It will not go back through the review stage.</strong>
          </p>
          {error && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

          {/* Replace file (optional — originator may have updated directly in SharePoint) */}
          <div className="rounded-lg border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Upload Revised Document (from Originator)</p>
            <div
              className="flex items-center gap-3 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-3 cursor-pointer hover:border-red-400 transition-colors"
              onClick={() => amendRef.current?.click()}
            >
              <Upload className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-500">
                {amendFile ? amendFile.name : 'Click to select revised document (optional)'}
              </span>
            </div>
            <input
              ref={amendRef}
              type="file"
              className="hidden"
              onChange={(e) => setAmendFile(e.target.files?.[0] ?? null)}
            />
            {amendFile && (
              <Button onClick={uploadAmendedFile} loading={loading === 'amend'} variant="outline">
                <Upload className="h-4 w-4" />
                Upload Revised Document
              </Button>
            )}
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">When ready, send back to approvers:</p>
            <Button onClick={resubmitForApproval} loading={loading === 'resubmit'}>
              <Send className="h-4 w-4" />
              Send for Re-Approval
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Document Manager: submit panel ───────────────────────────────────────
  if (canSubmit) {
    const isFirstSubmit = document.status === 'REGISTERED' || document.status === 'DRAFT'
    return (
      <div className="rounded-xl border-2 p-5 space-y-3" style={{ borderColor: '#F5A623', backgroundColor: '#FFFBEB' }}>
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" style={{ color: '#F5A623' }} />
          <h3 className="font-bold text-gray-800">
            {isFirstSubmit ? 'Ready to submit for review?' : 'Document returned — resubmit when ready'}
          </h3>
        </div>
        {!isFirstSubmit && (
          <p className="text-sm text-gray-600">
            This document was <strong>{document.status === 'REJECTED' ? 'rejected' : 'returned for changes'}</strong>.
            Update the document if needed, then resubmit to restart the review workflow.
          </p>
        )}
        {error && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
        <Button onClick={submitForReview} loading={loading === 'submit'} className="mt-1">
          {isFirstSubmit ? 'Submit for Review' : 'Resubmit for Review'}
        </Button>
      </div>
    )
  }

  // ── Policy: APPROVED → EXCO_PENDING ─────────────────────────────────────
  if (canExco) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: '#7C3AED' }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ backgroundColor: '#7C3AED' }}>
            <Landmark className="h-5 w-5 text-white" />
            <span className="font-bold text-white text-sm">Policy Document — Board/EXCO Approval Required</span>
          </div>
          <div className="p-5 bg-white space-y-4">
            <p className="text-sm text-gray-600">
              This is a <strong>Policy (PO)</strong> document. Before it can be marked as Controlled,
              it requires a <strong>Board / EXCO resolution</strong>. Submit it for EXCO first, then upload
              the signed resolution once it is passed.
            </p>
            {document.signedPageUrl && (
              <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                Signed page uploaded: <strong>{document.signedPageName}</strong>
              </div>
            )}
            {error && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={submitForExco}
                disabled={!!loading}
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60 hover:opacity-90"
                style={{ backgroundColor: '#7C3AED' }}
              >
                <Landmark className="h-4 w-4" />
                {loading === 'SUBMIT_EXCO' ? 'Submitting…' : 'Submit for EXCO Approval'}
              </button>
              {canCancel && (
                <button
                  onClick={() => controlDocument('CANCELLED')}
                  disabled={!!loading}
                  className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-60"
                >
                  <Ban className="h-4 w-4 text-red-500" />
                  {loading === 'CANCELLED' ? 'Cancelling…' : 'Cancel Document'}
                </button>
              )}
            </div>
          </div>
        </div>
        {canSign && <SignedPageUpload document={document} signFile={signFile} setSignFile={setSignFile} signRef={signRef} loading={loading} onUpload={uploadSignedPage} />}
      </div>
    )
  }

  // ── EXCO Pending: upload Board resolution → CONTROLLED ──────────────────
  if (canExcoCtrl) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: '#7C3AED' }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ backgroundColor: '#7C3AED' }}>
            <Landmark className="h-5 w-5 text-white" />
            <span className="font-bold text-white text-sm">Awaiting EXCO/Board Resolution</span>
          </div>
          <div className="p-5 bg-white space-y-4">
            <p className="text-sm text-gray-600">
              Document is pending <strong>Board/EXCO approval</strong>. Once the resolution is passed,
              upload the signed resolution document below to mark this document as <strong>Controlled</strong>.
            </p>
            {document.excoResolutionUrl && (
              <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                Resolution already on file: <strong>{document.excoResolutionName}</strong>
              </div>
            )}
            {error && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Board/EXCO Resolution Document *</label>
                <div
                  className="flex items-center gap-3 rounded-lg border-2 border-dashed border-purple-200 bg-purple-50 px-4 py-3 cursor-pointer hover:border-purple-400 transition-colors"
                  onClick={() => excoRef.current?.click()}
                >
                  <Upload className="h-5 w-5 text-purple-500 flex-shrink-0" />
                  <span className="text-sm text-purple-700">
                    {excoFile ? excoFile.name : 'Click to upload resolution (PDF or image)'}
                  </span>
                </div>
                <input ref={excoRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setExcoFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={uploadExcoResolution}
                  disabled={!excoFile || !!loading}
                  className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60 hover:opacity-90"
                  style={{ backgroundColor: excoFile ? '#7C3AED' : '#9CA3AF' }}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {loading === 'UPLOAD_RESOLUTION' ? 'Uploading & Controlling…' : 'Upload Resolution & Mark Controlled'}
                </button>
                {canCancel && (
                  <button
                    onClick={() => controlDocument('CANCELLED')}
                    disabled={!!loading}
                    className="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold text-gray-700 border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    <Ban className="h-4 w-4" />
                    Cancel Document
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        {canSign && <SignedPageUpload document={document} signFile={signFile} setSignFile={setSignFile} signRef={signRef} loading={loading} onUpload={uploadSignedPage} />}
      </div>
    )
  }

  // ── Mark as Controlled (after Approved, non-Policy) ──────────────────────
  if (canControl) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: '#16A34A' }}>
          <div className="px-5 py-3 flex items-center gap-2 bg-green-700">
            <ShieldCheck className="h-5 w-5 text-white" />
            <span className="font-bold text-white text-sm">Document Approved — Mark as Controlled</span>
          </div>
          <div className="p-5 bg-white space-y-4">
            <p className="text-sm text-gray-600">
              This document has been <strong>formally approved</strong>. Once the signed authorisation page has been
              scanned and attached (if required), mark it as <strong>Controlled</strong> to publish it as the official
              version. A 40-year retention record will be created automatically.
            </p>
            {document.signedPageUrl && (
              <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                Signed page uploaded: <strong>{document.signedPageName}</strong>
              </div>
            )}
            {error && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => controlDocument('CONTROLLED')}
                disabled={!!loading}
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white transition-all disabled:opacity-60 bg-green-700 hover:bg-green-800"
              >
                <ShieldCheck className="h-4 w-4" />
                {loading === 'CONTROLLED' ? 'Marking…' : 'Mark as Controlled'}
              </button>
              {canCancel && (
                <button
                  onClick={() => controlDocument('CANCELLED')}
                  disabled={!!loading}
                  className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-gray-700 border border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-60"
                >
                  <Ban className="h-4 w-4 text-red-500" />
                  {loading === 'CANCELLED' ? 'Cancelling…' : 'Cancel Document'}
                </button>
              )}
            </div>
          </div>
        </div>
        {canSign && <SignedPageUpload document={document} signFile={signFile} setSignFile={setSignFile} signRef={signRef} loading={loading} onUpload={uploadSignedPage} />}
      </div>
    )
  }

  // ── Mark as Superseded (Controlled doc) ───────────────────────────────────
  if (canSupersede) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border-2 border-gray-300 overflow-hidden">
          <div className="px-5 py-3 flex items-center gap-2 bg-gray-600">
            <Archive className="h-5 w-5 text-white" />
            <span className="font-bold text-white text-sm">Controlled Document — Lifecycle Actions</span>
          </div>
          <div className="p-5 bg-white space-y-4">
            <p className="text-sm text-gray-600">
              This is the current <strong>Controlled</strong> version. When a new revision is published,
              mark this document as <strong>Superseded</strong>. Superseded documents are retained for
              <strong> 40 years</strong> per the Records Retention Policy (CSS/PR/CSF/005 Section 19).
            </p>
            {document.retentionDate && (
              <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-500">
                Retention date: <strong>{new Date(document.retentionDate).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
              </div>
            )}
            {error && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => controlDocument('SUPERSEDED')}
                disabled={!!loading}
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold text-gray-700 border border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-60"
              >
                <Archive className="h-4 w-4" />
                {loading === 'SUPERSEDED' ? 'Marking…' : 'Mark as Superseded'}
              </button>
              <button
                onClick={() => controlDocument('CANCELLED')}
                disabled={!!loading}
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold border border-red-200 text-red-700 hover:bg-red-50 transition-all disabled:opacity-60"
              >
                <Ban className="h-4 w-4" />
                {loading === 'CANCELLED' ? 'Cancelling…' : 'Cancel Document'}
              </button>
            </div>
          </div>
        </div>
        {canSign && <SignedPageUpload document={document} signFile={signFile} setSignFile={setSignFile} signRef={signRef} loading={loading} onUpload={uploadSignedPage} />}
      </div>
    )
  }

  if (!canReview && !canApprove) {
    if (!canReplaceFile) return null
    // Uploader visiting while document is under active review or approval
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 overflow-hidden">
        <div className="px-5 py-3 flex items-center gap-2 bg-amber-100 border-b border-amber-200">
          <Upload className="h-4 w-4 text-amber-700" />
          <span className="font-bold text-amber-800 text-sm">Replace Document File</span>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-amber-800">
            If an incorrect version was sent, you can replace the file here.
            All active reviewers{document.status !== 'IN_REVIEW' ? '/approvers' : ''} will be notified automatically.
          </p>
          {error && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div
            className="flex items-center gap-3 rounded-lg border-2 border-dashed border-amber-300 bg-white px-4 py-3 cursor-pointer hover:border-amber-500 transition-colors"
            onClick={() => amendRef.current?.click()}
          >
            <Upload className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <span className="text-sm text-gray-500">
              {amendFile ? amendFile.name : 'Click to select replacement file'}
            </span>
          </div>
          <input
            ref={amendRef}
            type="file"
            className="hidden"
            onChange={(e) => setAmendFile(e.target.files?.[0] ?? null)}
          />
          {amendFile && (
            <Button onClick={uploadAmendedFile} loading={loading === 'amend'} variant="outline">
              <Upload className="h-4 w-4" />
              Upload Replacement
            </Button>
          )}
        </div>
      </div>
    )
  }

  // ── Reviewer / Approver: two-step action panel ────────────────────────────
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
        {/* Decision form */}
        <div className="rounded-lg border border-gray-200 p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white text-xs font-bold"
              style={{ backgroundColor: '#1C3557' }}
            >
              1
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">Submit your formal decision</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {isApproverAction
                  ? 'Your decision is final. Approve to publish this document, or reject to return it.'
                  : 'After reviewing, record your decision below. A comment is required.'}
              </p>
            </div>
          </div>

          {error && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

          {/* S7: Reviewer gets structured dropdown; approvers keep free-text */}
          {canReview && !isApproverAction ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Reviewer comments (required)</label>
                <select
                  value={reviewDecision}
                  onChange={(e) => setReviewDecision(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sanpc-navy focus:outline-none focus:ring-1 focus:ring-sanpc-navy"
                >
                  <option value="">— Select a decision —</option>
                  <option value="No comment — document reviewed as submitted">No comment — document reviewed as submitted</option>
                  <option value="Reviewed and accepted with minor corrections">Reviewed and accepted with minor corrections</option>
                  <option value="Changes required — see annotations in document">Changes required — see annotations in document</option>
                  <option value="Significant revision required — see notes below">Significant revision required — see notes below</option>
                  <option value="Other — specify below">Other — specify below</option>
                </select>
              </div>
              {['Changes required — see annotations in document', 'Significant revision required — see notes below', 'Other — specify below'].includes(reviewDecision) && (
                <Textarea
                  label="Additional notes"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={3}
                  placeholder="Provide further detail…"
                />
              )}
            </div>
          ) : (
            <Textarea
              label="Decision comments (optional)"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              placeholder="Add approval notes or reason for rejection…"
            />
          )}

          <div>
            {canReview && (
              <div className="space-y-3">
                <button
                  onClick={() => {
                    if (!reviewDecision) { setError('Please select a decision before marking complete.'); return }
                    setError(null)
                    const combined = reviewDecision + (comments.trim() ? ': ' + comments.trim() : '')
                    submitReview('APPROVED', combined)
                  }}
                  disabled={!!loading}
                  className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white transition-all disabled:opacity-60 hover:opacity-90"
                  style={{ backgroundColor: '#1C3557' }}
                >
                  <CheckCircle className="h-4 w-4" />
                  {loading === 'APPROVED' ? 'Submitting…' : 'Mark as Complete'}
                </button>
                <p className="text-[11px] text-gray-400">
                  Review the document above, select your decision, then mark your review as complete.
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

// ── Signed Page Upload sub-panel ─────────────────────────────────────────────
function SignedPageUpload({
  document, signFile, setSignFile, signRef, loading, onUpload,
}: {
  document: Document
  signFile: File | null
  setSignFile: (f: File | null) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signRef: React.RefObject<any>
  loading: string | null
  onUpload: () => void
}) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 flex items-center gap-2 border-b border-gray-200">
        <FileSignature className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-semibold text-gray-700">Signed Authorisation Page</span>
        {document.signedPageUrl && (
          <span className="ml-auto text-xs text-green-600 font-medium">✓ On file: {document.signedPageName}</span>
        )}
      </div>
      <div className="p-4 bg-white space-y-3">
        <p className="text-xs text-gray-500">
          Upload the physically signed authorisation page (scanned PDF or image). Required before marking as Controlled.
        </p>
        <div
          className="flex items-center gap-3 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-3 cursor-pointer hover:border-sanpc-navy transition-colors"
          onClick={() => signRef.current?.click()}
        >
          <Upload className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-500">
            {signFile ? signFile.name : 'Click to upload signed page (PDF/image)'}
          </span>
        </div>
        <input
          ref={signRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => setSignFile(e.target.files?.[0] ?? null)}
        />
        {signFile && (
          <button
            onClick={onUpload}
            disabled={!!loading}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white bg-green-700 hover:bg-green-800 disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {loading === 'SIGN_UPLOAD' ? 'Uploading…' : 'Upload Signed Page'}
          </button>
        )}
      </div>
    </div>
  )
}
