'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Download, Eye, EyeOff, FileX } from 'lucide-react'
import Button from '@/components/ui/Button'
import path from 'path'

interface DocumentViewerProps {
  documentId: string
  fileName: string
  fileType: string
}

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'])
const VIDEO_EXTS = new Set(['mp4', 'webm', 'ogg'])
const TEXT_EXTS = new Set(['txt', 'md', 'csv', 'json', 'xml', 'yaml', 'yml', 'log'])
const HTML_EXTS = new Set(['docx', 'xlsx', 'xls'])

function getExt(fileName: string): string {
  return path.extname(fileName).slice(1).toLowerCase()
}

type PreviewType = 'pdf' | 'image' | 'video' | 'text' | 'html' | 'none'

function getPreviewType(fileName: string): PreviewType {
  const ext = getExt(fileName)
  if (ext === 'pdf') return 'pdf'
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (VIDEO_EXTS.has(ext)) return 'video'
  if (TEXT_EXTS.has(ext)) return 'text'
  if (HTML_EXTS.has(ext)) return 'html'
  return 'none'
}

export default function DocumentViewer({ documentId, fileName, fileType }: DocumentViewerProps) {
  const [expanded, setExpanded] = useState(true)
  const [htmlContent, setHtmlContent] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [notPreviewable, setNotPreviewable] = useState(false)
  const [loading, setLoading] = useState(false)

  const previewType = getPreviewType(fileName)
  const previewUrl = `/api/documents/${documentId}/preview`
  const downloadUrl = `/api/documents/${documentId}/file`

  useEffect(() => {
    if (!expanded) return
    if (previewType === 'html' || previewType === 'text') {
      setLoading(true)
      fetch(previewUrl)
        .then(async (res) => {
          const contentType = res.headers.get('content-type') || ''
          if (contentType.includes('application/json')) {
            setNotPreviewable(true)
          } else if (contentType.includes('text/html')) {
            const text = await res.text()
            setHtmlContent(text)
          } else {
            const text = await res.text()
            setTextContent(text)
          }
        })
        .catch(() => setNotPreviewable(true))
        .finally(() => setLoading(false))
    } else if (previewType === 'none') {
      setNotPreviewable(true)
    }
  }, [previewUrl, previewType, expanded])

  const canPreview = previewType !== 'none'

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Document Preview</span>
          {!canPreview && (
            <span className="text-xs text-gray-400">— preview not available for this format</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={downloadUrl}
            download={fileName}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="bg-gray-50">
          {loading && (
            <div className="flex items-center justify-center h-40 text-sm text-gray-400">
              Loading preview...
            </div>
          )}

          {!loading && previewType === 'pdf' && (
            <iframe
              src={previewUrl}
              className="w-full border-0"
              style={{ height: '75vh' }}
              title={fileName}
            />
          )}

          {!loading && previewType === 'image' && (
            <div className="flex justify-center p-4 bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={fileName}
                className="max-w-full max-h-[75vh] object-contain rounded shadow"
              />
            </div>
          )}

          {!loading && previewType === 'video' && (
            <div className="p-4 bg-black flex justify-center">
              <video
                controls
                src={previewUrl}
                className="max-w-full max-h-[75vh]"
              />
            </div>
          )}

          {!loading && previewType === 'html' && htmlContent && (
            <iframe
              srcDoc={htmlContent}
              className="w-full border-0 bg-white"
              style={{ height: '75vh' }}
              sandbox="allow-same-origin"
              title={fileName}
            />
          )}

          {!loading && previewType === 'text' && textContent && (
            <pre className="p-4 text-xs font-mono text-gray-800 overflow-auto max-h-[75vh] whitespace-pre-wrap break-all bg-white">
              {textContent}
            </pre>
          )}

          {!loading && (notPreviewable || previewType === 'none') && (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
              <FileX className="h-10 w-10 opacity-40" />
              <p className="text-sm">Preview not available for this file type.</p>
              <a
                href={downloadUrl}
                download={fileName}
                className="inline-flex items-center gap-1.5 rounded-md bg-sanpc-navy px-3 py-1.5 text-sm text-white hover:bg-sanpc-navy-dark transition-colors"
              >
                <Download className="h-4 w-4" />
                Download to view
              </a>
            </div>
          )}
        </div>
      )}

      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-xs text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <EyeOff className="h-3.5 w-3.5" />
          Preview hidden — click to expand
        </button>
      )}
    </div>
  )
}
