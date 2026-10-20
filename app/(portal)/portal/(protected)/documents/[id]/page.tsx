import { getSession } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import {
  ChevronLeft, Download, FileText, Calendar, User, Tag,
  Hash, RefreshCw, ShieldCheck, Globe, History,
  FileCheck, BookOpen, Paperclip,
} from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

function formatDate(dateStr: string | Date | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function fileTypeLabel(type: string) {
  const map: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/msword': 'Word',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
    'application/vnd.ms-excel': 'Excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
    'application/vnd.ms-powerpoint': 'PowerPoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
  }
  return map[type] ?? type.split('/').pop()?.toUpperCase() ?? 'File'
}

function MetaRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md mt-0.5"
        style={{ backgroundColor: '#E8EDF4' }}>
        <Icon className="h-3.5 w-3.5" style={{ color: '#1C3557' }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-sm text-gray-800 font-medium mt-0.5 break-words">{value || '—'}</p>
      </div>
    </div>
  )
}

export default async function PortalDocumentDetailPage({ params }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/portal/login')

  const { id } = await params

  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      uploadedBy:    { select: { name: true, email: true } },
      originatorUser: { select: { name: true, email: true } },
      authorizerUser: { select: { name: true, email: true } },
      versions: {
        orderBy: { versionNumber: 'desc' },
        include: { uploadedBy: { select: { name: true } } },
      },
      attachments: {
        orderBy: { createdAt: 'asc' },
        include: { uploadedBy: { select: { name: true } } },
      },
      metadata: true,
      activities: {
        where: { action: { in: ['CONTROLLED', 'APPROVED', 'AUTHORIZED', 'AMENDED'] } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { name: true } } },
      },
    },
  })

  // Only show CONTROLLED documents in the portal
  if (!doc || doc.status !== 'CONTROLLED') notFound()

  const downloadUrl = doc.sharePointUrl || doc.fileUrl
  const hasSigned = !!(doc.signedPageUrl)
  const hasExco = !!(doc.excoResolutionUrl)

  const activityLabels: Record<string, string> = {
    CONTROLLED: 'Document Controlled',
    APPROVED: 'Document Approved',
    AUTHORIZED: 'Document Authorized',
    AMENDED: 'Document Amended',
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

      {/* Back */}
      <Link
        href="/portal/documents"
        className="inline-flex items-center gap-1.5 text-sm font-medium mb-6 hover:underline"
        style={{ color: '#1C3557' }}
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Document Library
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">

        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">

          {/* Document header card */}
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #1C3557 0%, #0D9488 100%)' }} />
            <div className="p-6">
              {/* Status badge */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white"
                  style={{ backgroundColor: '#15803D' }}>
                  <FileCheck className="h-3 w-3" />
                  Controlled
                </span>
                <div className="text-xs text-gray-400 text-right">
                  {doc.controlledAt ? (
                    <span>Published {formatDate(doc.controlledAt)}</span>
                  ) : null}
                </div>
              </div>

              {/* Title */}
              <h1 className="text-xl font-bold text-gray-900 leading-tight mb-2">{doc.title}</h1>

              {/* Doc number / revision */}
              {(doc.documentNumber || doc.revision) && (
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  {doc.documentNumber && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-gray-50 border border-gray-100 px-3 py-1.5">
                      <Hash className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-sm font-mono font-semibold text-gray-700">{doc.documentNumber}</span>
                    </div>
                  )}
                  {doc.revision && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-gray-50 border border-gray-100 px-3 py-1.5">
                      <RefreshCw className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-sm font-mono font-semibold text-gray-700">Revision {doc.revision}</span>
                    </div>
                  )}
                  {doc.category && (
                    <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
                      style={{ backgroundColor: '#E8EDF4' }}>
                      <Tag className="h-3.5 w-3.5" style={{ color: '#1C3557' }} />
                      <span className="text-sm font-medium" style={{ color: '#1C3557' }}>{doc.category}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              {doc.description && (
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{doc.description}</p>
              )}

              {/* Purpose */}
              {doc.purpose && (
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Purpose</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{doc.purpose}</p>
                </div>
              )}

              {/* Tags */}
              {doc.tags && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {doc.tags.split(',').map((t) => t.trim()).filter(Boolean).map((tag) => (
                    <span key={tag} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Download button */}
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 shadow-sm"
                  style={{ backgroundColor: '#1C3557' }}
                >
                  <Download className="h-4 w-4" />
                  Download Document
                  <span className="opacity-60 text-xs ml-1">({fileTypeLabel(doc.fileType)} · {formatFileSize(doc.fileSize)})</span>
                </a>
                {hasSigned && (
                  <a
                    href={doc.signedPageUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <ShieldCheck className="h-4 w-4 text-green-600" />
                    Signed Page
                  </a>
                )}
                {hasExco && (
                  <a
                    href={doc.excoResolutionUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <FileText className="h-4 w-4 text-purple-600" />
                    Board Resolution
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Attachments */}
          {doc.attachments.length > 0 && (
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-6">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800 mb-4">
                <Paperclip className="h-4 w-4 text-gray-400" />
                Attachments
                <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{doc.attachments.length}</span>
              </h2>
              <div className="space-y-2">
                {doc.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{att.fileName}</p>
                        {att.label && <p className="text-xs text-gray-500">{att.label}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400">{formatFileSize(att.fileSize)}</span>
                      <Download className="h-4 w-4 text-gray-400" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Version History */}
          {doc.versions.length > 0 && (
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-6">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800 mb-4">
                <History className="h-4 w-4 text-gray-400" />
                Version History
              </h2>
              <div className="space-y-2">
                {doc.versions.map((v, idx) => (
                  <div key={v.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: idx === 0 ? '#15803D' : '#6B7280' }}>
                        v{v.versionNumber}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{v.fileName}</p>
                        <p className="text-xs text-gray-400">Uploaded by {v.uploadedBy.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400">{formatDate(v.createdAt)}</span>
                      {idx === 0 && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                          Current
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity */}
          {doc.activities.length > 0 && (
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-6">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800 mb-4">
                <BookOpen className="h-4 w-4 text-gray-400" />
                Document Milestones
              </h2>
              <div className="relative">
                <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-100" />
                <div className="space-y-4 pl-9">
                  {doc.activities.map((act) => (
                    <div key={act.id} className="relative">
                      <div className="absolute -left-[22px] flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gray-100">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: '#1C3557' }} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {activityLabels[act.action] ?? act.action}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {act.user.name} · {formatDate(act.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: metadata */}
        <div className="space-y-6">

          {/* Document Metadata */}
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Document Information</h2>
            <div className="divide-y divide-gray-50">
              <MetaRow icon={Calendar} label="Date Controlled" value={formatDate(doc.controlledAt)} />
              {doc.originalDate && (
                <MetaRow icon={Calendar} label="Original Issue Date" value={formatDate(doc.originalDate)} />
              )}
              {doc.nextReviewDate && (
                <MetaRow icon={Calendar} label="Next Review Date" value={formatDate(doc.nextReviewDate)} />
              )}
              {doc.retentionDate && (
                <MetaRow icon={Calendar} label="Retention Date" value={formatDate(doc.retentionDate)} />
              )}
              <MetaRow icon={FileText} label="Document Type" value={doc.category} />
              {doc.documentTypeCode && (
                <MetaRow icon={Hash} label="Type Code" value={doc.documentTypeCode} />
              )}
              <MetaRow icon={RefreshCw} label="Revision" value={doc.revision ? `Rev ${doc.revision}` : null} />
              {doc.amendmentCount > 0 && (
                <MetaRow icon={RefreshCw} label="Amendments" value={`${doc.amendmentCount} amendment${doc.amendmentCount !== 1 ? 's' : ''}`} />
              )}
            </div>
          </div>

          {/* People */}
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Responsible Parties</h2>
            <div className="divide-y divide-gray-50">
              {doc.originatorUser && (
                <MetaRow icon={User} label="Originator" value={doc.originatorUser.name} />
              )}
              {doc.originator && !doc.originatorUser && (
                <MetaRow icon={User} label="Originator" value={doc.originator} />
              )}
              {doc.authorisedBy && (
                <MetaRow icon={ShieldCheck} label="Authorised By" value={doc.authorisedBy} />
              )}
              {doc.authorizerUser && (
                <MetaRow icon={ShieldCheck} label="Authorizer" value={doc.authorizerUser.name} />
              )}
              <MetaRow icon={User} label="Document Controller" value={doc.uploadedBy.name} />
            </div>
          </div>

          {/* Custom metadata fields */}
          {doc.metadata.length > 0 && (
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Additional Details</h2>
              <div className="divide-y divide-gray-50">
                {doc.metadata.map((m) => (
                  <MetaRow key={m.id} icon={Globe} label={m.key} value={m.value} />
                ))}
              </div>
            </div>
          )}

          {/* SharePoint link */}
          {doc.sharePointUrl && (
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Online Access</h2>
              <a
                href={doc.sharePointUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Globe className="h-4 w-4" style={{ color: '#1C3557' }} />
                Open in SharePoint
              </a>
            </div>
          )}

          {/* Back */}
          <Link
            href="/portal/documents"
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Library
          </Link>
        </div>
      </div>
    </div>
  )
}
