'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Download, FileText, User, Calendar, Tag, Layers,
  CheckCircle, Clock, XCircle, AlertTriangle, ExternalLink,
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

const reviewStatusIcon = {
  PENDING: <Clock className="h-4 w-4 text-gray-400" />,
  IN_PROGRESS: <Clock className="h-4 w-4 text-sanpc-navy" />,
  APPROVED: <CheckCircle className="h-4 w-4 text-green-500" />,
  REJECTED: <XCircle className="h-4 w-4 text-red-500" />,
  CHANGES_REQUESTED: <XCircle className="h-4 w-4 text-yellow-500" />,
}

interface Props {
  initialDoc: Document
  session: SessionUser
}

export default function DocumentDetail({ initialDoc, session }: Props) {
  const [doc, setDoc] = useState<Document>(initialDoc)
  const [comments, setComments] = useState<DocumentComment[]>(initialDoc.comments)
  const [activities, setActivities] = useState<DocumentActivity[]>(initialDoc.activities)

  function handleCommentAdded(comment: DocumentComment) {
    setComments((prev) => [...prev, comment])
    // Add activity optimistically
    setActivities((prev) => [{
      id: `temp-${Date.now()}`,
      action: 'COMMENT_ADDED',
      details: null,
      createdAt: new Date().toISOString(),
      user: { name: session.name, email: session.email },
    }, ...prev])
  }

  function handleDocUpdate(updated: Document) {
    // API action routes don't re-fetch versions/activities — preserve them from current state
    setDoc({ ...updated, versions: doc.versions, activities: doc.activities })
    if (updated.activities?.length) setActivities(updated.activities)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/documents" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{doc.title}</h1>
            <Badge variant="secondary" className="flex-shrink-0">v{doc.version}</Badge>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={doc.status} />
            {doc.sharePointUrl && (
              <a
                href={doc.sharePointUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors"
                style={{ backgroundColor: '#0078D4', color: '#fff' }}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.5 2C9.46 2 7 4.46 7 7.5c0 .95.25 1.84.68 2.61L3 14.5V20h5.5l4.32-4.32c.47.2.98.32 1.5.32 2.76 0 5-2.24 5-5S15.76 2 12.5 2zm0 8c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3z"/>
                </svg>
                Open &amp; Annotate
              </a>
            )}
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Document Viewer */}
          <DocumentViewer
            documentId={doc.id}
            fileName={doc.fileName}
            fileType={doc.fileType}
          />

          {/* Action Panel */}
          <ReviewPanel document={doc} session={session} onUpdate={handleDocUpdate} />

          {/* Description */}
          <Card>
            <h2 className="font-semibold text-gray-800 mb-3">Description</h2>
            {doc.description ? (
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{doc.description}</p>
            ) : (
              <p className="text-sm text-gray-400">No description provided.</p>
            )}
          </Card>

          {/* Review Workflow */}
          {doc.reviews.length > 0 && (() => {
            const reviewerSteps = doc.reviews.filter((r) => !r.isApprover)
            const approverSteps = doc.reviews.filter((r) => r.isApprover)

            function ParallelGroup({ reviews, label, isApproverGroup }: { reviews: typeof doc.reviews; label: string; isApproverGroup: boolean }) {
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
                      return (
                        <div
                          key={review.id}
                          className={`flex items-start gap-3 rounded-lg p-3 border transition-colors ${
                            isActive ? 'border-sanpc-navy bg-sanpc-navy-light' :
                            review.status === 'APPROVED' ? 'border-green-200 bg-green-50' :
                            review.status === 'REJECTED' || review.status === 'CHANGES_REQUESTED' ? 'border-red-200 bg-red-50' :
                            'border-gray-100 bg-gray-50'
                          }`}
                        >
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
                                {deadlineLabel && (
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                    overdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    <AlertTriangle className="h-3 w-3" />{deadlineLabel}
                                  </span>
                                )}
                              </div>
                              {!isApproverGroup && review.status === 'APPROVED'
                                ? <Badge variant="success">Completed</Badge>
                                : <StatusBadge status={review.status} />
                              }
                            </div>
                            {/* SharePoint link for active reviewers */}
                            {isActive && doc.sharePointUrl && (
                              <a
                                href={doc.sharePointUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold text-white transition-all hover:opacity-90"
                                style={{ backgroundColor: '#0078D4' }}
                              >
                                <ExternalLink className="h-3 w-3" />
                                Open in Office Online
                              </a>
                            )}
                            {review.comments && <p className="mt-1 text-xs text-gray-500 italic">"{review.comments}"</p>}
                            {review.reviewedAt && <p className="text-xs text-gray-400 mt-0.5">{formatDate(review.reviewedAt)}</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            }

            return (
              <Card>
                <h2 className="font-semibold text-gray-800 mb-4">Review Workflow</h2>
                {reviewerSteps.length > 0 && (
                  <div className="mb-5">
                    <ParallelGroup reviews={reviewerSteps} label="Reviewers" isApproverGroup={false} />
                  </div>
                )}
                {approverSteps.length > 0 && (
                  <div className={reviewerSteps.length > 0 ? 'border-t pt-5' : ''}>
                    <ParallelGroup reviews={approverSteps} label="Approvers" isApproverGroup={true} />
                  </div>
                )}
              </Card>
            )
          })()}

          {/* Comments */}
          <Card>
            <h2 className="font-semibold text-gray-800 mb-4">Comments</h2>
            <CommentThread
              documentId={doc.id}
              comments={comments}
              onCommentAdded={handleCommentAdded}
            />
          </Card>

          {/* Activity Log */}
          <Card>
            <h2 className="font-semibold text-gray-800 mb-4">Activity Log</h2>
            <ActivityLog activities={activities} />
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* File Info */}
          <Card>
            <h2 className="font-semibold text-gray-800 mb-4">File Information</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <dt className="text-xs text-gray-500">File Name</dt>
                  <dd className="text-gray-800 break-all">{doc.fileName}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Layers className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <dt className="text-xs text-gray-500">Size</dt>
                  <dd className="text-gray-800">{formatBytes(doc.fileSize)}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Tag className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <dt className="text-xs text-gray-500">Type</dt>
                  <dd className="text-gray-800 break-all">{doc.fileType || '—'}</dd>
                </div>
              </div>
              {doc.category && (
                <div>
                  <dt className="text-xs text-gray-500">Category</dt>
                  <dd className="text-gray-800">{doc.category}</dd>
                </div>
              )}
              {doc.tags && (
                <div>
                  <dt className="text-xs text-gray-500">Tags</dt>
                  <dd className="flex flex-wrap gap-1 mt-1">
                    {doc.tags.split(',').map((tag) => (
                      <span key={tag.trim()} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {tag.trim()}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {/* People */}
          <Card>
            <h2 className="font-semibold text-gray-800 mb-4">People</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <dt className="text-xs text-gray-500">Uploaded By</dt>
                  <dd className="text-gray-800">{doc.uploadedBy.name}</dd>
                </div>
              </div>
              {doc.reviews.filter((r) => !r.isApprover).length > 0 && (
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <dt className="text-xs text-gray-500">Reviewers</dt>
                    <dd className="text-gray-800 space-y-0.5">
                      {doc.reviews.filter((r) => !r.isApprover).map((r, i) => (
                        <div key={r.id} className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-400">#{i + 1}</span>
                          <span>{r.reviewer.name}</span>
                        </div>
                      ))}
                    </dd>
                  </div>
                </div>
              )}
              {doc.reviews.filter((r) => r.isApprover).length > 0 && (
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <dt className="text-xs text-gray-500">Approvers</dt>
                    <dd className="text-gray-800 space-y-0.5">
                      {doc.reviews.filter((r) => r.isApprover).map((r, i) => (
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

          {/* Dates */}
          <Card>
            <h2 className="font-semibold text-gray-800 mb-4">Timeline</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <dt className="text-xs text-gray-500">Created</dt>
                  <dd className="text-gray-800">{formatDate(doc.createdAt)}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <dt className="text-xs text-gray-500">Last Updated</dt>
                  <dd className="text-gray-800">{formatDate(doc.updatedAt)}</dd>
                </div>
              </div>
            </dl>
          </Card>

          {/* Version History */}
          <Card>
            <h2 className="font-semibold text-gray-800 mb-4">Version History</h2>
            <VersionHistory
              documentId={doc.id}
              currentVersion={doc.version}
              versions={doc.versions}
            />
          </Card>

          {/* Metadata */}
          {doc.metadata.length > 0 && (
            <Card>
              <h2 className="font-semibold text-gray-800 mb-4">Metadata</h2>
              <MetadataList metadata={doc.metadata} />
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
