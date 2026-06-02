'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, ExternalLink, Send } from 'lucide-react'

interface Props {
  token: string
  documentId: string
  documentTitle: string
  sharePointUrl: string | null
  isApprover: boolean
  alreadyDone: boolean
  wrongStage: boolean
  reviewStatus: string
}

export default function ReviewAction({
  token,
  documentId,
  documentTitle,
  sharePointUrl,
  isApprover,
  alreadyDone,
  wrongStage,
  reviewStatus,
}: Props) {
  const [comments, setComments] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [done, setDone] = useState<{ message: string; decision: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  async function submit(decision: string) {
    setLoading(decision)
    setError(null)
    try {
      const res = await fetch(`/api/review-token/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, comments }),
      })
      const data = await res.json()
      if (res.ok) {
        setDone({ message: data.message, decision })
      } else {
        setError(data.error || 'Something went wrong. Please try again.')
      }
    } finally {
      setLoading(null)
    }
  }

  // ── Already submitted ──────────────────────────────────────────────────────
  if (alreadyDone || done) {
    const decision = done?.decision ?? reviewStatus
    const isApproved = decision === 'APPROVED'
    return (
      <div className="px-6 py-8 text-center">
        <div className={`inline-flex h-16 w-16 items-center justify-center rounded-full mb-4 ${
          isApproved ? 'bg-green-100' : 'bg-red-100'
        }`}>
          {isApproved
            ? <CheckCircle className="h-8 w-8 text-green-600" />
            : <XCircle className="h-8 w-8 text-red-600" />
          }
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          {done ? done.message : `Already ${isApproved ? 'completed' : 'submitted'}`}
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          Your {isApprover ? 'decision' : 'review'} for <strong>{documentTitle}</strong> has been recorded.
        </p>
        <a
          href={`${appUrl}/documents/${documentId}`}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: '#1C3557' }}
        >
          <ExternalLink className="h-4 w-4" />
          View Document in DMS
        </a>
      </div>
    )
  }

  // ── Wrong stage (document status changed) ─────────────────────────────────
  if (wrongStage) {
    return (
      <div className="px-6 py-8 text-center">
        <div className="text-4xl mb-3">ℹ️</div>
        <p className="text-sm text-gray-600">
          This document is no longer awaiting your {isApprover ? 'approval' : 'review'}.
          It may have been recalled or advanced.
        </p>
        <a
          href={`${appUrl}/documents/${documentId}`}
          className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: '#1C3557' }}
        >
          <ExternalLink className="h-4 w-4" />
          View Document in DMS
        </a>
      </div>
    )
  }

  // ── Active review / approval ───────────────────────────────────────────────
  return (
    <div className="px-6 py-5 space-y-5">

      {/* Step 1: Open in SharePoint */}
      {sharePointUrl && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
              1
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-800 text-sm">Open &amp; annotate in Office Online</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Read the document. Use <strong>Word comments</strong> or <strong>Track Changes</strong> to leave
                inline feedback — all collaborators see your annotations in real time.
              </p>
              <a
                href={sharePointUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: '#0078D4' }}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.5 2C9.46 2 7 4.46 7 7.5c0 .95.25 1.84.68 2.61L3 14.5V20h5.5l4.32-4.32c.47.2.98.32 1.5.32 2.76 0 5-2.24 5-5S15.76 2 12.5 2zm0 8c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3z"/>
                </svg>
                Open &amp; Annotate in Office Online
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Submit decision */}
      <div className="rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white text-xs font-bold"
            style={{ backgroundColor: '#1C3557' }}
          >
            {sharePointUrl ? '2' : '1'}
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm">Submit your formal decision</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {isApprover
                ? 'Your decision is final. Approve to publish this document, or reject to return it to the manager.'
                : 'Once you have reviewed and annotated the document, record your decision here. This is logged in the audit trail.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
          placeholder={
            isApprover
              ? 'Add approval notes or reason for rejection…'
              : 'Summarise your findings, issues noted, or any comments for the document manager…'
          }
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1C3557] focus:outline-none focus:ring-1 focus:ring-[#1C3557] resize-none"
        />

        {/* Reviewer: single button */}
        {!isApprover && (
          <div className="space-y-2">
            <button
              onClick={() => submit('APPROVED')}
              disabled={!!loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold text-white transition-all disabled:opacity-60 hover:opacity-90"
              style={{ backgroundColor: '#1C3557' }}
            >
              <CheckCircle className="h-4 w-4" />
              {loading === 'APPROVED' ? 'Submitting…' : 'Mark Review Complete'}
            </button>
            <p className="text-[11px] text-gray-400 text-center">
              Ensure you have added your annotations in Office Online before submitting.
            </p>
          </div>
        )}

        {/* Approver: two buttons */}
        {isApprover && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => submit('APPROVED')}
                disabled={!!loading}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-white transition-all disabled:opacity-60 hover:opacity-90"
                style={{ backgroundColor: '#16A34A' }}
              >
                <CheckCircle className="h-4 w-4" />
                {loading === 'APPROVED' ? 'Approving…' : 'Final Approve'}
              </button>
              <button
                onClick={() => submit('REJECTED')}
                disabled={!!loading}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-white transition-all disabled:opacity-60 bg-red-600 hover:bg-red-700"
              >
                <XCircle className="h-4 w-4" />
                {loading === 'REJECTED' ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
            <p className="text-[11px] text-gray-400">
              <strong>Final Approve</strong> — marks document as officially approved &nbsp;·&nbsp;
              <strong>Reject</strong> — returns document to manager with your comments
            </p>
          </div>
        )}
      </div>

    </div>
  )
}
