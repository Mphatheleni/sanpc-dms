/**
 * DLT-09: Inline preview for attachments.
 * PDF  → served inline (browser renders natively)
 * DOCX/DOC → converted to HTML via mammoth
 * Others   → JSON { previewable: false }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { downloadFromSharePoint, isSharePointConfigured } from '@/lib/sharepoint'
import { downloadFromGCS, isGCSConfigured } from '@/lib/gcs'
import { getFilePath } from '@/lib/file'
import { readFile, access } from 'fs/promises'
import path from 'path'

function getExt(fileName: string) {
  return path.extname(fileName).slice(1).toLowerCase()
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, attachmentId } = await params
    const attachment = await prisma.documentAttachment.findUnique({ where: { id: attachmentId } })
    if (!attachment || attachment.documentId !== id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const ext = getExt(attachment.fileName)
    const isSharePointId = isSharePointConfigured() &&
      !attachment.fileUrl.startsWith('attach-') &&
      !attachment.fileUrl.includes('/')

    // Fetch the file buffer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let buffer: any

    if (isSharePointId) {
      const { body } = await downloadFromSharePoint(attachment.fileUrl)
      const chunks: Uint8Array[] = []
      const reader = (body as ReadableStream<Uint8Array>).getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) chunks.push(value)
      }
      buffer = Buffer.concat(chunks)
    } else if (isGCSConfigured()) {
      const { buffer: gcsBuffer } = await downloadFromGCS(attachment.fileUrl)
      buffer = gcsBuffer
    } else {
      const filePath = getFilePath(attachment.fileUrl)
      try {
        await access(filePath)
        buffer = await readFile(filePath)
      } catch {
        return NextResponse.json({ previewable: false, message: 'File not found' })
      }
    }

    // Images — serve inline
    const imageMimes: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
    }
    if (imageMimes[ext]) {
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': imageMimes[ext],
          'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
        },
      })
    }

    // PDF — serve inline
    if (ext === 'pdf') {
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
        },
      })
    }

    // Word — mammoth to HTML
    if (ext === 'docx' || ext === 'doc') {
      const mammothMod = await import('mammoth')
      // Handle both ESM default-export and CJS named-export interop patterns
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mammoth = (mammothMod as any).default ?? mammothMod
      const result = await mammoth.convertToHtml({ buffer })
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #111; }
        h1,h2,h3,h4 { margin-top: 1.5em; }
        table { border-collapse: collapse; width: 100%; }
        td, th { border: 1px solid #ddd; padding: 6px 12px; }
        th { background: #f5f5f5; }
      </style></head><body>${result.value}</body></html>`
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    // Excel — convert first sheet to HTML table
    if (ext === 'xlsx' || ext === 'xls') {
      const xlsxMod = await import('xlsx')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const XLSX = (xlsxMod as any).default ?? xlsxMod
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      if (!workbook.SheetNames.length) {
        return NextResponse.json({ previewable: false, message: 'Excel file contains no sheets.' })
      }
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const html = XLSX.utils.sheet_to_html(firstSheet, { id: 'sheet', editable: false })
      const wrapped = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body { font-family: system-ui, sans-serif; margin: 1rem; font-size: 13px; }
        table { border-collapse: collapse; width: 100%; }
        td, th { border: 1px solid #ccc; padding: 4px 8px; white-space: nowrap; }
        tr:nth-child(even) { background: #f9f9f9; }
        th { background: #e8e8e8; font-weight: 600; }
      </style></head><body>${html}</body></html>`
      return new NextResponse(wrapped, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    return NextResponse.json({ previewable: false, message: `No preview for .${ext} files` })
  } catch (err) {
    console.error('[attachment/preview] error:', err)
    return NextResponse.json({ previewable: false, message: 'Preview failed' })
  }
}
