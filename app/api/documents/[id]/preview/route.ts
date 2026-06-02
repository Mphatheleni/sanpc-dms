import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getFilePath } from '@/lib/file'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'])
const VIDEO_EXTS = new Set(['mp4', 'webm', 'ogg'])
const TEXT_EXTS = new Set(['txt', 'md', 'csv', 'json', 'xml', 'yaml', 'yml', 'log'])

function getExt(fileName: string): string {
  return path.extname(fileName).slice(1).toLowerCase()
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const document = await prisma.document.findUnique({ where: { id } })
  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const filePath = getFilePath(document.fileUrl)
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 })
  }

  const ext = getExt(document.fileName)
  const buffer = await readFile(filePath)

  // PDF — browsers render natively
  if (ext === 'pdf') {
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${document.fileName}"`,
      },
    })
  }

  // Images
  if (IMAGE_EXTS.has(ext)) {
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': document.fileType || `image/${ext}`,
        'Content-Disposition': 'inline',
      },
    })
  }

  // Videos
  if (VIDEO_EXTS.has(ext)) {
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': document.fileType || `video/${ext}`,
        'Content-Disposition': 'inline',
      },
    })
  }

  // Plain text types
  if (TEXT_EXTS.has(ext)) {
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'inline',
      },
    })
  }

  // Word documents — convert to HTML with mammoth
  if (ext === 'docx') {
    const mammoth = await import('mammoth')
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

  // Excel — convert first sheet to HTML table with xlsx
  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(buffer, { type: 'buffer' })
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

  // Not previewable
  return NextResponse.json({
    previewable: false,
    message: `Preview is not available for .${ext} files. Please download to view.`,
  })
}
