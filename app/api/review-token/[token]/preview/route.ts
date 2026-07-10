import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyReviewToken } from '@/lib/reviewToken'
import { getFilePath } from '@/lib/file'
import { downloadFromSharePoint } from '@/lib/sharepoint'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'])
const VIDEO_EXTS = new Set(['mp4', 'webm', 'ogg'])
const TEXT_EXTS = new Set(['txt', 'md', 'csv', 'json', 'xml', 'yaml', 'yml', 'log'])

function getExt(fileName: string): string {
  return path.extname(fileName).slice(1).toLowerCase()
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const payload = await verifyReviewToken(token)
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

  const document = await prisma.document.findUnique({ where: { id: payload.documentId } })
  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ext = getExt(document.fileName)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let buffer: any

  if (document.sharePointItemId) {
    try {
      const { body } = await downloadFromSharePoint(document.sharePointItemId)
      const chunks: Uint8Array[] = []
      const reader = (body as ReadableStream<Uint8Array>).getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) chunks.push(value)
      }
      buffer = Buffer.concat(chunks)
    } catch (err) {
      console.error('[review-preview] SharePoint download failed:', err)
      return NextResponse.json({ error: 'Failed to retrieve file from SharePoint' }, { status: 502 })
    }
  } else {
    const filePath = getFilePath(document.fileUrl)
    if (!existsSync(filePath)) return NextResponse.json({ error: 'File not found' }, { status: 404 })
    buffer = await readFile(filePath)
  }

  if (ext === 'pdf') {
    return new NextResponse(buffer, {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${document.fileName}"` },
    })
  }
  if (IMAGE_EXTS.has(ext)) {
    return new NextResponse(buffer, {
      headers: { 'Content-Type': document.fileType || `image/${ext}`, 'Content-Disposition': 'inline' },
    })
  }
  if (VIDEO_EXTS.has(ext)) {
    return new NextResponse(buffer, {
      headers: { 'Content-Type': document.fileType || `video/${ext}`, 'Content-Disposition': 'inline' },
    })
  }
  if (TEXT_EXTS.has(ext)) {
    return new NextResponse(buffer, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': 'inline' },
    })
  }
  if (ext === 'docx') {
    const mammoth = await import('mammoth')
    const result = await mammoth.convertToHtml({ buffer })
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #111; }
      h1,h2,h3,h4 { margin-top: 1.5em; }
      table { border-collapse: collapse; width: 100%; }
      td,th { border: 1px solid #ddd; padding: 6px 12px; }
      th { background: #f5f5f5; }
    </style></head><body>${result.value}</body></html>`
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const html = XLSX.utils.sheet_to_html(firstSheet, { id: 'sheet', editable: false })
    const wrapped = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body { font-family: system-ui, sans-serif; margin: 1rem; font-size: 13px; }
      table { border-collapse: collapse; width: 100%; }
      td,th { border: 1px solid #ccc; padding: 4px 8px; white-space: nowrap; }
      tr:nth-child(even) { background: #f9f9f9; }
      th { background: #e8e8e8; font-weight: 600; }
    </style></head><body>${html}</body></html>`
    return new NextResponse(wrapped, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  return NextResponse.json({ previewable: false })
}
