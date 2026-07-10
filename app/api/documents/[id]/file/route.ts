import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getFilePath } from '@/lib/file'
import { downloadFromSharePoint } from '@/lib/sharepoint'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

/**
 * Stamp a PDF buffer with a SANPC-style status watermark.
 * Uses pdf-lib (pure JS, no native deps).
 *
 * Watermark text per status:
 *  DRAFT             → "DRAFT"
 *  CONTROLLED        → "CONTROLLED"
 *  SUPERSEDED        → "SUPERSEDED"
 *  CANCELLED         → "CANCELLED"
 *  (all others)      → no watermark
 */
async function stampPdf(buffer: Buffer, status: string): Promise<Buffer> {
  const labels: Record<string, { text: string; color: [number, number, number] }> = {
    DRAFT:      { text: 'DRAFT',      color: [0.5, 0.5, 0.5] },
    CONTROLLED: { text: 'CONTROLLED', color: [0.05, 0.20, 0.34] },
    SUPERSEDED: { text: 'SUPERSEDED', color: [0.55, 0.55, 0.55] },
    CANCELLED:  { text: 'CANCELLED',  color: [0.75, 0.10, 0.10] },
  }

  const cfg = labels[status]
  if (!cfg) return buffer  // no watermark for other statuses

  try {
    const { PDFDocument, rgb, degrees } = await import('pdf-lib')
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true })
    const pages  = pdfDoc.getPages()

    for (const page of pages) {
      const { width, height } = page.getSize()
      page.drawText(cfg.text, {
        x: width * 0.08,
        y: height * 0.42,
        size: Math.min(width, height) * 0.16,
        color: rgb(...cfg.color),
        rotate: degrees(45),
        opacity: 0.18,
      })
    }

    const stamped = await pdfDoc.save()
    return Buffer.from(stamped)
  } catch (err) {
    console.error('[file] PDF watermark failed, returning original:', err)
    return buffer
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const document = await prisma.document.findUnique({ where: { id } })
  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isPdf = path.extname(document.fileName).toLowerCase() === '.pdf'
  const headers = {
    'Content-Type': document.fileType || 'application/octet-stream',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
  }

  // File is in SharePoint — fetch buffer (we need it for watermarking)
  let buffer: Buffer

  if (document.sharePointItemId) {
    try {
      const { body, contentType } = await downloadFromSharePoint(document.sharePointItemId)

      // If not a PDF, stream directly without buffering
      if (!isPdf) {
        return new NextResponse(body as ReadableStream, {
          headers: { ...headers, 'Content-Type': contentType },
        })
      }

      // Buffer the PDF for watermarking
      const chunks: Uint8Array[] = []
      const reader = (body as ReadableStream<Uint8Array>).getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) chunks.push(value)
      }
      buffer = Buffer.concat(chunks)
    } catch (err) {
      console.error('[file] SharePoint download failed:', err)
      return NextResponse.json({ error: 'Failed to retrieve file from SharePoint' }, { status: 502 })
    }
  } else {
    const filePath = getFilePath(document.fileUrl)
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found on disk' }, { status: 404 })
    }
    buffer = await readFile(filePath)
  }

  // Apply PDF watermark based on document status
  if (isPdf) {
    buffer = await stampPdf(buffer, document.status)
  }

  prisma.documentActivity.create({
    data: { documentId: id, userId: session.userId, action: 'DOWNLOADED' },
  }).catch(() => {})

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextResponse(buffer as any, {
    headers: { ...headers, 'Content-Length': buffer.length.toString() },
  })
}
