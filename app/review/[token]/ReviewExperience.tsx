'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  CheckCircle, XCircle, AlertTriangle, ExternalLink, Loader2,
  Send, MessageSquare, FileText, Clock, Info, Download,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'

/* ── types ─────────────────────────────────────────────────────── */
interface Comment {
  id: string
  content: string
  createdAt: string
  author: { id: string; name: string; email: string; role: string }
}

interface Props {
  token: string
  documentId: string
  documentTitle: string
  documentDescription: string | null
  fileName: string
  fileSize: number
  category: string | null
  sharePointUrl: string | null
  uploaderName: string
  reviewerName: string
  reviewerEmail: string
  isApprover: boolean
  alreadyDone: boolean
  wrongStage: boolean
  reviewStatus: string
  deadlineLabel: string | null
  overdue: boolean
  initialComments: Comment[]
  version: number
}

/* ── helpers ──────────────────────────────────────────────────── */
function formatDate(date: string) {
  return new Date(date).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

/* ── document viewer (token-gated) ────────────────────────────── */
function TokenDocumentViewer({ token, fileName, sharePointUrl }: {
  token: string
  fileName: string
  sharePointUrl: string | null
}) {
  const [expanded, setExpanded] = useState(true)
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const previewUrl = `/api/review-token/${token}/preview`
  const downloadUrl = `/api/review-token/${token}/preview` // same route serves inline

  const isPdf    = ext === 'pdf'
  const isImage  = ['jpg','jpeg','png','gif','webp','svg'].includes(ext)
  const isText   = ['txt','md','csv','json','xml','yaml','yml','log'].includes(ext)
  const isOffice = ['docx','xlsx','xls'].includes(ext)
  const isVideo  = ['mp4','webm','ogg'].includes(ext)
  const canPreview = isPdf || isImage || isText || isOffice || isVideo

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Viewer header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Document</span>
          <span className="text-xs text-gray-400">{fileName}</span>
        </div>
        <div className="flex items-center gap-2">
          {sharePointUrl && (
            <a
              href={sharePointUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-bold text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: '#0078D4' }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Office Online
            </a>
          )}
          <a
            href={previewUrl}
            download={fileName}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 px-1"
          >
            {expanded ? '▲ Hide' : '▼ Show'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="bg-gray-50">
          {isPdf && (
            <iframe src={previewUrl} className="w-full border-0" style={{ height: '70vh' }} title={fileName} />
          )}
          {isImage && (
            <div className="flex justify-center p-4 bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt={fileName} className="max-w-full max-h-[70vh] object-contain rounded shadow" />
            </div>
          )}
          {isVideo && (
            <div className="flex justify-center p-4 bg-black">
              <video controls src={previewUrl} className="max-w-full max-h-[70vh]" />
            </div>
          )}
          {(isText || isOffice) && (
            <iframe src={previewUrl} className="w-full border-0 bg-white" style={{ height: '70vh' }} title={fileName} sandbox="allow-same-origin" />
          )}
          {!canPreview && (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
              <FileText className="h-10 w-10 opacity-30" />
              <p className="text-sm">Preview not available for .{ext} files.</p>
              <a
                href={previewUrl}
                download={fileName}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-white"
                style={{ backgroundColor: '#1C3557' }}
              >
                <Download className="h-4 w-4" />
                Download to view
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── comment thread (token-gated) ──────────────────────────────── */
function TokenCommentThread({ token, initialComments }: {
  token: string
  initialComments: Comment[]
}) {
  const [comments, setComments] = useState(initialComments)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/review-token/${token}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text.trim() }),
      })
      if (res.ok) {
        const comment = await res.json()
        setComments((prev) => [...prev, comment])
        setText('')
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Failed to post comment')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {comments.length === 0 && (
        <p className="text-sm text-gray-400 py-2">No comments yet.</p>
      )}
      {comments.map((c) => (
        <div key={c.id} className="flex gap-2.5">
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: '#1C3557' }}
          >
            {initials(c.author.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 mb-0.5">
              <span className="text-xs font-semibold text-gray-800">{c.author.name}</span>
              <span className="text-[10px] text-gray-400">{formatDate(c.createdAt)}</span>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
          </div>
        </div>
      ))}
      <form onSubmit={submit} className="flex gap-2 pt-2 border-t border-gray-100">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment…"
          rows={2}
        />
        <Button
          type="submit"
          disabled={!text.trim() || loading}
          style={{ backgroundColor: '#1C3557', color: 'white' }}
          className="self-end"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

/* ── decision panel ────────────────────────────────────────────── */
function DecisionPanel({
  token, isApprover, alreadyDone, wrongStage, reviewStatus, documentTitle, documentId,
}: {
  token: string; isApprover: boolean; alreadyDone: boolean; wrongStage: boolean
  reviewStatus: string; documentTitle: string; documentId: string
}) {
  const [comments, setComments] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [done, setDone] = useState<{ message: string; decision: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  async function submit(decision: string) {
    setLoading(decision); setError(null)
    try {
      const res = await fetch(`/api/review-token/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, comments }),
      })
      const data = await res.json()
      if (res.ok) { setDone({ message: data.message, decision }) }
      else { setError(data.error || 'Something went wrong.') }
    } finally { setLoading(null) }
  }

  if (alreadyDone || done) {
    const decision = done?.decision ?? reviewStatus
    const isApproved = decision === 'APPROVED'
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center space-y-3">
        <div className={`inline-flex h-14 w-14 items-center justify-center rounded-full ${isApproved ? 'bg-green-100' : 'bg-red-100'}`}>
          {isApproved
            ? <CheckCircle className="h-7 w-7 text-green-600" />
            : <XCircle className="h-7 w-7 text-red-600" />
          }
        </div>
        <div>
          <p className="font-bold text-gray-900">{done?.message ?? `Already ${isApproved ? 'completed' : 'submitted'}`}</p>
          <p className="text-sm text-gray-500 mt-1">Your {isApprover ? 'decision' : 'review'} for <strong>{documentTitle}</strong> has been recorded.</p>
        </div>
        <a href={`${appUrl}/documents/${documentId}`}>
          <Button style={{ backgroundColor: '#1C3557', color: 'white' }} className="gap-2 mt-2">
            <ExternalLink className="h-4 w-4" />
            View in DMS
          </Button>
        </a>
      </div>
    )
  }

  if (wrongStage) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center space-y-2">
        <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
        <p className="font-semibold text-gray-800">No action required</p>
        <p className="text-sm text-gray-500">This document is no longer awaiting your {isApprover ? 'approval' : 'review'}.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100" style={{ backgroundColor: isApprover ? '#FEF3C7' : '#E8EDF4' }}>
        <p className="text-sm font-bold" style={{ color: isApprover ? '#92400E' : '#1C3557' }}>
          {isApprover ? '⚡ Final approval required' : '📋 Review required'}
        </p>
        <p className="text-xs mt-0.5" style={{ color: isApprover ? '#B45309' : '#4A7AB5' }}>
          {isApprover
            ? 'Your decision is final. Approve to publish, or reject to return to the manager.'
            : 'Review the document above, add any notes below, then mark complete.'}
        </p>
      </div>
      <div className="p-4 space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600">
            {isApprover ? 'Approval notes (optional)' : 'Review notes (optional)'}
          </label>
          <Textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            placeholder={isApprover
              ? 'Reason for approval or rejection…'
              : 'Summary of findings, issues noted, or notes for the manager…'}
          />
        </div>
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {!isApprover && (
          <Button
            onClick={() => submit('APPROVED')}
            disabled={!!loading}
            className="w-full"
            style={{ backgroundColor: '#1C3557', color: 'white' }}
          >
            {loading === 'APPROVED'
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</>
              : <><CheckCircle className="mr-2 h-4 w-4" />Mark Review Complete</>
            }
          </Button>
        )}
        {isApprover && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => submit('APPROVED')}
              disabled={!!loading}
              style={{ backgroundColor: '#16A34A', color: 'white' }}
              className="w-full"
            >
              {loading === 'APPROVED'
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Approving…</>
                : <><CheckCircle className="mr-2 h-4 w-4" />Final Approve</>
              }
            </Button>
            <Button
              onClick={() => submit('REJECTED')}
              disabled={!!loading}
              variant="destructive"
              className="w-full"
            >
              {loading === 'REJECTED'
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Rejecting…</>
                : <><XCircle className="mr-2 h-4 w-4" />Reject</>
              }
            </Button>
          </div>
        )}
        <p className="text-[10px] text-gray-400 text-center">
          Your decision is logged in the audit trail and the document manager is notified.
        </p>
      </div>
    </div>
  )
}

/* ── main ──────────────────────────────────────────────────────── */
export default function ReviewExperience({
  token, documentId, documentTitle, documentDescription, fileName, fileSize,
  category, sharePointUrl, uploaderName, reviewerName, reviewerEmail,
  isApprover, alreadyDone, wrongStage, reviewStatus, deadlineLabel, overdue,
  initialComments, version,
}: Props) {
  const [tab, setTab] = useState<'comments' | 'decision'>('decision')

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f4f6f9' }}>

      {/* ── Header ── */}
      <header className="flex-shrink-0 shadow-sm" style={{ backgroundColor: '#1C3557' }}>
        <div className="flex items-center gap-3 px-5 py-3">
          <Image src="/logo.png" alt="SANPC" width={28} height={28} style={{ objectFit: 'contain' }} unoptimized priority />
          <div>
            <div className="text-white font-extrabold text-sm tracking-tight leading-tight">SANPC DMS</div>
            <div className="text-[9px] font-semibold tracking-[0.2em] uppercase" style={{ color: '#F5A623' }}>
              Powering Your Tomorrow
            </div>
          </div>

          <div className="h-5 w-px mx-2 bg-white/20 flex-shrink-0" />

          {/* SharePoint branding */}
          <div className="flex items-center gap-1.5">
            <div className="grid grid-cols-3 gap-0.5 h-5 w-5 flex-shrink-0">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="rounded-[1px] bg-white/70" />
              ))}
            </div>
            <span className="text-xs font-semibold text-white/80">SharePoint</span>
          </div>

          <div className="flex-1" />

          {/* Reviewer identity */}
          <div className="hidden sm:flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: '#F5A623' }}
            >
              {initials(reviewerName)}
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-white leading-tight">{reviewerName}</p>
              <p className="text-[10px] text-white/50 leading-tight">{isApprover ? 'Approver' : 'Reviewer'}</p>
            </div>
          </div>
        </div>

        {/* Document info bar */}
        <div className="flex items-center gap-4 px-5 py-2 border-t border-white/10 bg-white/5 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-white/50 flex-shrink-0" />
            <span className="text-sm font-semibold text-white truncate">{documentTitle}</span>
            <span className="text-[10px] text-white/40 flex-shrink-0">v{version}</span>
            {category && <span className="text-[10px] text-white/40">· {category}</span>}
          </div>
          <div className="flex-1" />
          {deadlineLabel && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold flex-shrink-0 ${
              overdue ? 'bg-red-500 text-white' : 'bg-amber-400 text-amber-900'
            }`}>
              <Clock className="h-3 w-3" />
              {overdue ? 'Overdue — ' : ''}{deadlineLabel}
            </span>
          )}
          {sharePointUrl && (
            <a
              href={sharePointUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded px-3 py-1 text-xs font-bold text-white flex-shrink-0 hover:opacity-90"
              style={{ backgroundColor: '#0078D4' }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Office Online
            </a>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">

        {/* Left: document viewer */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 min-w-0">

          {/* SharePoint info banner (when configured) */}
          {sharePointUrl && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-start gap-2.5">
              <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Collaborative editing available</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Open in Office Online to annotate using Word comments and Track Changes.
                  All reviewers share the same document — your annotations are visible to everyone.
                  Come back here to submit your formal decision.
                </p>
              </div>
            </div>
          )}

          {/* Document meta (when no SharePoint) */}
          {!sharePointUrl && (
            <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: '#E8EDF4' }}>
                <FileText className="h-5 w-5" style={{ color: '#1C3557' }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800 truncate">{fileName}</p>
                <p className="text-xs text-gray-400">{formatBytes(fileSize)} · Uploaded by {uploaderName}</p>
              </div>
              <span className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 rounded px-2 py-1 flex-shrink-0">
                SharePoint not configured — preview only
              </span>
            </div>
          )}

          <TokenDocumentViewer token={token} fileName={fileName} sharePointUrl={sharePointUrl} />
        </main>

        {/* Right: actions + comments */}
        <aside className="flex-shrink-0 w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-gray-200 bg-white flex flex-col overflow-hidden">

          {/* Tab bar */}
          <div className="flex border-b border-gray-200 flex-shrink-0">
            <button
              onClick={() => setTab('decision')}
              className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
                tab === 'decision' ? 'border-b-2 text-[#1C3557]' : 'text-gray-500 hover:text-gray-700'
              }`}
              style={tab === 'decision' ? { borderColor: '#1C3557' } : {}}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              {isApprover ? 'Approval Decision' : 'Review Decision'}
              {!alreadyDone && !wrongStage && (
                <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: '#F5A623' }}>
                  1
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('comments')}
              className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
                tab === 'comments' ? 'border-b-2 text-[#1C3557]' : 'text-gray-500 hover:text-gray-700'
              }`}
              style={tab === 'comments' ? { borderColor: '#1C3557' } : {}}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Discussion
              {initialComments.length > 0 && (
                <span className="ml-0.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold text-gray-600">
                  {initialComments.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            {tab === 'decision' && (
              <div className="space-y-4">
                <DecisionPanel
                  token={token}
                  isApprover={isApprover}
                  alreadyDone={alreadyDone}
                  wrongStage={wrongStage}
                  reviewStatus={reviewStatus}
                  documentTitle={documentTitle}
                  documentId={documentId}
                />
                {documentDescription && (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</p>
                    <p className="text-sm text-gray-700">{documentDescription}</p>
                  </div>
                )}
              </div>
            )}

            {tab === 'comments' && (
              <TokenCommentThread token={token} initialComments={initialComments} />
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-gray-100 px-4 py-3 bg-gray-50">
            <p className="text-[10px] text-gray-400 text-center">
              Secure link for <strong>{reviewerEmail}</strong>. Do not share this URL.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
