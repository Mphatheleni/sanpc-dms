'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, ExternalLink, Loader2, AlertTriangle } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'

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
      <div className="px-6 py-10 text-center">
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
        <p className="text-sm text-gray-500 mb-6">
          Your {isApprover ? 'decision' : 'review'} for <strong>{documentTitle}</strong> has been recorded.
        </p>
        <a href={`${appUrl}/documents/${documentId}`}>
          <Button style={{ backgroundColor: '#1C3557', color: 'white' }} className="gap-2">
            <ExternalLink className="h-4 w-4" />
            View Document in DMS
          </Button>
        </a>
      </div>
    )
  }

  // ── Wrong stage ────────────────────────────────────────────────────────────
  if (wrongStage) {
    return (
      <div className="px-6 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 mx-auto mb-4">
          <AlertTriangle className="h-7 w-7 text-amber-600" />
        </div>
        <h2 className="text-base font-bold text-gray-900 mb-1">No Action Required</h2>
        <p className="text-sm text-gray-500 mb-6">
          This document is no longer awaiting your {isApprover ? 'approval' : 'review'}.
          It may have been recalled or advanced.
        </p>
        <a href={`${appUrl}/documents/${documentId}`}>
          <Button style={{ backgroundColor: '#1C3557', color: 'white' }} className="gap-2">
            <ExternalLink className="h-4 w-4" />
            View Document in DMS
          </Button>
        </a>
      </div>
    )
  }

  // ── Active review / approval ───────────────────────────────────────────────
  return (
    <div className="px-6 py-5 space-y-4">

      {/* Step 1: Open in SharePoint */}
      {sharePointUrl && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">1</div>
            <div className="flex-1">
              <p className="font-semibold text-gray-800 text-sm">Open &amp; annotate in Office Online</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Read the document. Use <strong>Word comments</strong> or <strong>Track Changes</strong> to leave
                inline feedback.
              </p>
              <a
                href={sharePointUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white"
                style={{ backgroundColor: '#0078D4' }}
              >
                <ExternalLink className="h-4 w-4" />
                Open &amp; Annotate in Office Online
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
                ? 'Your decision is final. Approve to publish this document, or reject to return it.'
                : 'After reviewing, record your decision. This is logged in the audit trail.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <Textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
          placeholder={
            isApprover
              ? 'Add approval notes or reason for rejection…'
              : 'Summarise your findings, issues noted, or any comments for the manager…'
          }
        />

        {!isApprover && (
          <div className="space-y-2">
            <Button
              onClick={() => submit('APPROVED')}
              disabled={!!loading}
              className="w-full h-11"
              style={{ backgroundColor: '#1C3557', color: 'white' }}
            >
              {loading === 'APPROVED' ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</>
              ) : (
                <><CheckCircle className="mr-2 h-4 w-4" />Mark Review Complete</>
              )}
            </Button>
            <p className="text-[11px] text-gray-400 text-center">
              Ensure annotations are added in Office Online before submitting.
            </p>
          </div>
        )}

        {isApprover && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => submit('APPROVED')}
                disabled={!!loading}
                className="flex-1"
                style={{ backgroundColor: '#16A34A', color: 'white' }}
              >
                {loading === 'APPROVED' ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Approving…</>
                ) : (
                  <><CheckCircle className="mr-2 h-4 w-4" />Final Approve</>
                )}
              </Button>
              <Button
                onClick={() => submit('REJECTED')}
                disabled={!!loading}
                variant="destructive"
                className="flex-1"
              >
                {loading === 'REJECTED' ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Rejecting…</>
                ) : (
                  <><XCircle className="mr-2 h-4 w-4" />Reject</>
                )}
              </Button>
            </div>
            <p className="text-[11px] text-gray-400">
              <strong>Final Approve</strong> — marks document as officially approved &nbsp;·&nbsp;
              <strong>Reject</strong> — returns to manager with your comments
            </p>
          </div>
        )}
      </div>

    </div>
  )
}
