import Link from 'next/link'
import { FileText, Clock, User } from 'lucide-react'
import Card from '@/components/ui/Card'
import StatusBadge from './StatusBadge'
import type { Document } from '@/types'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function DocumentCard({ doc }: { doc: Document }) {
  return (
    <Link href={`/documents/${doc.id}`}>
      <Card
        padding={false}
        className="p-4 hover:border-sanpc-amber hover:shadow-md transition-all cursor-pointer"
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 rounded-lg bg-sanpc-navy-light p-2.5">
            <FileText className="h-5 w-5 text-sanpc-navy" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-medium text-gray-900 truncate">{doc.title}</h3>
              <StatusBadge status={doc.status} />
            </div>
            {doc.description && (
              <p className="text-sm text-gray-500 line-clamp-2 mb-2">{doc.description}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {doc.uploadedBy.name}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(doc.updatedAt)}
              </span>
              <span>{formatBytes(doc.fileSize)}</span>
              {doc.category && (
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">
                  {doc.category}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}
