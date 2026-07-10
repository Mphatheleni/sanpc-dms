import {
  Eye, Upload, CheckCircle, XCircle, RefreshCw,
  MessageSquare, FilePlus, Download, ThumbsUp, ThumbsDown, ShieldCheck, Archive, Ban,
  Landmark, FileSignature, PenLine,
} from 'lucide-react'
import type { ActivityAction } from '@/types'

interface ActivityEntry {
  id: string
  action: ActivityAction
  details: string | null
  createdAt: string
  user: { name: string; email: string }
}

const actionConfig: Partial<Record<ActivityAction, { label: string; icon: React.ElementType; color: string }>> = {
  CREATED:                   { label: 'Uploaded document',        icon: FilePlus,    color: 'text-sanpc-navy bg-sanpc-navy-light' },
  VIEWED:                    { label: 'Viewed document',          icon: Eye,         color: 'text-gray-400 bg-gray-100' },
  DOWNLOADED:                { label: 'Downloaded document',      icon: Download,    color: 'text-gray-500 bg-gray-100' },
  SUBMITTED:                 { label: 'Submitted for review',     icon: Upload,      color: 'text-purple-500 bg-purple-50' },
  REVIEW_APPROVED:           { label: 'Approved review',          icon: CheckCircle, color: 'text-green-500 bg-green-50' },
  REVIEW_REJECTED:           { label: 'Rejected in review',       icon: XCircle,     color: 'text-red-500 bg-red-50' },
  REVIEW_CHANGES_REQUESTED:  { label: 'Requested changes',        icon: RefreshCw,   color: 'text-yellow-600 bg-yellow-50' },
  APPROVED:                  { label: 'Finally approved',         icon: ThumbsUp,    color: 'text-green-600 bg-green-100' },
  REJECTED:                  { label: 'Finally rejected',         icon: ThumbsDown,  color: 'text-red-600 bg-red-100' },
  COMMENT_ADDED:             { label: 'Added a comment',          icon: MessageSquare, color: 'text-sanpc-navy bg-sanpc-navy-light' },
  CONTROLLED:                { label: 'Marked as Controlled',     icon: ShieldCheck,    color: 'text-green-700 bg-green-100' },
  SUPERSEDED:                { label: 'Marked as Superseded',     icon: Archive,        color: 'text-gray-500 bg-gray-100' },
  CANCELLED:                 { label: 'Cancelled document',       icon: Ban,            color: 'text-red-500 bg-red-50' },
  EXCO_SUBMITTED:            { label: 'Submitted for EXCO',       icon: Landmark,       color: 'text-purple-600 bg-purple-50' },
  SIGNED_PAGE_UPLOADED:      { label: 'Uploaded signed page',     icon: FileSignature,  color: 'text-green-600 bg-green-50' },
  AMENDED:                   { label: 'Document amended',         icon: PenLine,        color: 'text-blue-600 bg-blue-50' },
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function formatFull(date: string): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function ActivityLog({ activities = [] }: { activities?: ActivityEntry[] }) {
  if (activities.length === 0) {
    return <p className="text-sm text-gray-400">No activity recorded yet.</p>
  }

  return (
    <div className="space-y-0">
      {activities.map((entry, i) => {
        const cfg = actionConfig[entry.action] ?? {
          label: entry.action, icon: Eye, color: 'text-gray-400 bg-gray-100',
        }
        const Icon = cfg.icon
        const isLast = i === activities.length - 1

        return (
          <div key={entry.id} className="flex gap-3">
            {/* Timeline spine */}
            <div className="flex flex-col items-center">
              <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${cfg.color}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              {!isLast && <div className="mt-1 flex-1 w-px bg-gray-200 mb-1" />}
            </div>

            {/* Content */}
            <div className={`flex-1 pb-3 ${isLast ? '' : ''}`}>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-800">{entry.user.name}</span>
                <span className="text-sm text-gray-500">{cfg.label}</span>
                <span
                  className="text-xs text-gray-400 cursor-default"
                  title={formatFull(entry.createdAt)}
                >
                  {timeAgo(entry.createdAt)}
                </span>
              </div>
              {entry.details && (
                <p className="mt-0.5 text-xs text-gray-500 italic">"{entry.details}"</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
