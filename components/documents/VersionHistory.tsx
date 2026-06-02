import { Download, History } from 'lucide-react'

interface DocVersion {
  id: string
  versionNumber: number
  fileName: string
  fileSize: number
  fileType: string
  createdAt: string
  uploadedBy: { name: string }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

interface Props {
  documentId: string
  currentVersion: number
  versions: DocVersion[]
}

export default function VersionHistory({ documentId, currentVersion, versions = [] }: Props) {
  if (versions.length === 0) {
    return (
      <p className="text-sm text-gray-400 flex items-center gap-1.5">
        <History className="h-4 w-4" />
        No prior versions — this is the original.
      </p>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {/* Previous versions */}
      {versions
        .sort((a, b) => b.versionNumber - a.versionNumber)
        .map((v) => (
          <div key={v.id} className="flex items-center gap-3 py-2 text-sm">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500 flex-shrink-0">
              v{v.versionNumber}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-700 truncate">{v.fileName}</p>
              <p className="text-xs text-gray-400">
                {formatBytes(v.fileSize)} · {v.uploadedBy.name} · {formatDate(v.createdAt)}
              </p>
            </div>
            <a
              href={`/api/documents/${documentId}/versions/${v.versionNumber}/file`}
              download={v.fileName}
              className="flex-shrink-0 rounded p-1.5 text-gray-400 hover:text-sanpc-navy hover:bg-sanpc-navy-light transition-colors"
              title={`Download v${v.versionNumber}`}
            >
              <Download className="h-4 w-4" />
            </a>
          </div>
        ))}

      <div className="pt-2">
        <p className="text-xs text-gray-400">
          Current version: <strong>v{currentVersion}</strong>
        </p>
      </div>
    </div>
  )
}
