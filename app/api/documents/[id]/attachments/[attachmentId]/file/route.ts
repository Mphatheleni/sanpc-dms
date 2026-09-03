/**
 * DLT-09: Download an attachment file.
 * All authenticated users with doc access can download.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { downloadFromSharePoint, isSharePointConfigured } from '@/lib/sharepoint'
import { downloadFromGCS, isGCSConfigured } from '@/lib/gcs'
import { getFilePath } from '@/lib/file'
import { readFile, access } from 'fs/promises'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, attachmentId } = await params
  const attachment = await prisma.documentAttachment.findUnique({ where: { id: attachmentId } })
  if (!attachment || attachment.documentId !== id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const headers = {
    'Content-Type': attachment.fileType || 'application/octet-stream',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
  }

  // SharePoint: item IDs are stored when uploaded via SharePoint (not a local path/uuid)
  const isSharePointId = isSharePointConfigured() &&
    !attachment.fileUrl.startsWith('attach-') &&
    !attachment.fileUrl.includes('/')

  if (isSharePointId) {
    try {
      const { body, contentType } = await downloadFromSharePoint(attachment.fileUrl)
      return new NextResponse(body as ReadableStream, {
        headers: { ...headers, 'Content-Type': contentType },
      })
    } catch (err) {
      console.error('[attachment/file] SharePoint download failed:', err)
      return NextResponse.json({ error: 'Failed to retrieve file from SharePoint' }, { status: 502 })
    }
  }

  if (isGCSConfigured()) {
    try {
      const { buffer } = await downloadFromGCS(attachment.fileUrl)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new NextResponse(buffer as any, {
        headers: { ...headers, 'Content-Length': buffer.length.toString() },
      })
    } catch (err) {
      console.error('[attachment/file] GCS failed:', err)
    }
  }

  // Local fallback
  const filePath = getFilePath(attachment.fileUrl)
  try {
    await access(filePath)
    const buffer = await readFile(filePath)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new NextResponse(buffer as any, {
      headers: { ...headers, 'Content-Length': buffer.length.toString() },
    })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
