'use client'

import { useState } from 'react'
import {
  Eye, Upload, CheckCircle, XCircle, RefreshCw,
  MessageSquare, FilePlus, Download, ThumbsUp, ThumbsDown, ShieldCheck, Archive, Ban,
  Landmark, FileSignature, PenLine, Paperclip, ArrowRightLeft, Filter,
} from 'lucide-react'
import type { ActivityAction } from '@/types'

interface ActivityEntry {
  id: string
  action: ActivityAction
  details: string | null
  createdAt: string
  user: { name: string; email: string }
}

interface CollapsedEntry extends ActivityEntry {
  viewCount?: number
}

const actionConfig: Partial<Record<ActivityAction, { label: string; icon: React.ElementType; color: string; important: boolean }>> = {
  CREATED:                   { label: 'Uploaded document',        icon: FilePlus,      color: 'text-sanpc-navy bg-sanpc-navy-light',  important: true  },
  VIEWED:                    { label: 'Viewed document',          icon: Eye,           color: 'text-gray-400 bg-gray-100',            important: false },
  DOWNLOADED:                { label: 'Downloaded document',      icon: Download,      color: 'text-gray-500 bg-gray-100',            important: true  },
  SUBMITTED:                 { label: 'Submitted for review',     icon: Upload,        color: 'text-purple-500 bg-purple-50',         important: true  },
  REVIEW_APPROVED:           { label: 'Approved review',          icon: CheckCircle,   color: 'text-green-500 bg-green-50',           important: true  },
  REVIEW_REJECTED:           { label: 'Rejected in review',       icon: XCircle,       color: 'text-red-500 bg-red-50',               important: true  },
  REVIEW_CHANGES_REQUESTED:  { label: 'Requested changes',        icon: RefreshCw,     color: 'text-yellow-600 bg-yellow-50',         important: true  },
  APPROVED:                  { label: 'Finally approved',         icon: ThumbsUp,      color: 'text-green-600 bg-green-100',          important: true  },
  REJECTED:                  { label: 'Finally rejected',         icon: ThumbsDown,    color: 'text-red-600 bg-red-100',              important: true  },
  COMMENT_ADDED:             { label: 'Added a comment',          icon: MessageSquare, color: 'text-sanpc-navy bg-sanpc-navy-light',  important: true  },
  CONTROLLED:                { label: 'Marked as Controlled',     icon: ShieldCheck,   color: 'text-green-700 bg-green-100',          important: true  },
  SUPERSEDED:                { label: 'Marked as Superseded',     icon: Archive,       color: 'text-gray-500 bg-gray-100',            important: true  },
  CANCELLED:                 { label: 'Cancelled document',       icon: Ban,           color: 'text-red-500 bg-red-50',               important: true  },
  EXCO_SUBMITTED:            { label: 'Submitted for EXCO',       icon: Landmark,      color: 'text-purple-600 bg-purple-50',         important: true  },
  SIGNED_PAGE_UPLOADED:      { label: 'Uploaded signed page',     icon: FileSignature, color: 'text-green-600 bg-green-50',           important: true  },
  AMENDED:                   { label: 'Document amended',         icon: PenLine,       color: 'text-blue-600 bg-blue-50',             important: true  },
  ATTACHMENT_ADDED:          { label: 'Attachment uploaded',      icon: Paperclip,     color: 'text-teal-600 bg-teal-50',             important: true  },
  ATTACHMENT_REMOVED:        { label: 'Attachment removed',       icon: Paperclip,     color: 'text-gray-500 bg-gray-100',            important: true  },
  STATUS_CHANGED:            { label: 'Status changed manually',  icon: ArrowRightLeft, color: 'text-orange-600 bg-orange-50',        important: true  },
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatFull(date: string): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Collapse consecutive VIEWED entries by the same user into a single summarised entry */
function collapseViews(entries: ActivityEntry[]): CollapsedEntry[] {
  const result: CollapsedEntry[] = []
  let i = 0
  while (i < entries.length) {
    const entry = entries[i]
    if (entry.action === 'VIEWED') {
      let count = 1
      let j = i + 1
      while (j < entries.length && entries[j].action === 'VIEWED' && entries[j].user.email === entry.user.email) {
        count++
        j++
      }
      result.push({ ...entry, viewCount: count })
      i = j
    } else {
      result.push(entry)
      i++
    }
  }
  return result
}

export default function ActivityLog({ activities = [] }: { activities?: ActivityEntry[] }) {
  const [filter, setFilter] = useState<'important' | 'all'>('important')

  if (activities.length === 0) {
    return <p className="text-sm text-gray-400">No activity recorded yet.</p>
  }

  // Newest first
  const sorted = [...activities].reverse()

  const importantCount = sorted.filter((e) => actionConfig[e.action]?.important !== false).length
  const allCollapsed = collapseViews(sorted)

  const displayed: CollapsedEntry[] = filter === 'important'
    ? sorted
        .filter((e) => actionConfig[e.action]?.important !== false)
        .map((e) => ({ ...e }))
    : allCollapsed

  return (
    <div className="space-y-3">
      {/* Filter pills + summary */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
        <button
          onClick={() => setFilter('important')}
          className={`rounded-full px-3 py-0.5 text-xs font-semibold transition-colors ${
            filter === 'important'
              ? 'bg-sanpc-navy text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          Important ({importantCount})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`rounded-full px-3 py-0.5 text-xs font-semibold transition-colors ${
            filter === 'all'
              ? 'bg-sanpc-navy text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          All ({activities.length})
        </button>
        {filter === 'important' && importantCount < activities.length && (
          <span className="text-xs text-gray-400">
            · {activities.length - importantCount} view{activities.length - importantCount !== 1 ? 's' : ''} hidden
          </span>
        )}
      </div>

      {/* Scrollable timeline */}
      <div className="max-h-[420px] overflow-y-auto pr-1 space-y-0">
        {displayed.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No activity in this category.</p>
        ) : (
          displayed.map((entry, i) => {
            const cfg = actionConfig[entry.action] ?? {
              label: entry.action, icon: Eye, color: 'text-gray-400 bg-gray-100', important: false,
            }
            const Icon = cfg.icon
            const isLast = i === displayed.length - 1
            const isView = entry.action === 'VIEWED'
            const viewCount = entry.viewCount ?? 1

            return (
              <div key={entry.id} className="flex gap-3">
                {/* Timeline spine */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full ${cfg.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {!isLast && <div className="mt-1 flex-1 w-px bg-gray-100 mb-1" />}
                </div>

                {/* Content */}
                <div className="flex-1 pb-3 min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{entry.user.name}</span>
                    <span className="text-sm text-gray-500">
                      {isView && viewCount > 1
                        ? `viewed ${viewCount} times`
                        : cfg.label.toLowerCase()}
                    </span>
                    <span
                      className="text-xs text-gray-400 cursor-default ml-auto flex-shrink-0"
                      title={formatFull(entry.createdAt)}
                    >
                      {timeAgo(entry.createdAt)}
                    </span>
                  </div>
                  {entry.details && (
                    <p className="mt-0.5 text-xs text-gray-400 italic truncate" title={entry.details}>
                      {entry.details}
                    </p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
