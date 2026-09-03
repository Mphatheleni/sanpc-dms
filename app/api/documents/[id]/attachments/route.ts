/**
 * Attachments — list + upload
 * Available at any point in the document lifecycle.
 * Upload restricted to DOCUMENT_MANAGER / ADMIN.
 * Everyone with access can GET.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { uploadToSharePoint, isSharePointConfigured } from '@/lib/sharepoint'
import { uploadToGCS, isGCSConfigured } from '@/lib/gcs'
import { saveFile } from '@/lib/file'
import { randomUUID } from 'crypto'
import path from 'path'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const attachments = await prisma.documentAttachment.findMany({
    where: { documentId: id },
    include: { uploadedBy: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(attachments)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // DLT-09: only DC or Admin can upload attachments
  if (session.role !== 'DOCUMENT_MANAGER' && session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Document Controller only' }, { status: 403 })
  }

  const { id } = await params
  const doc = await prisma.document.findUnique({ where: { id }, select: { id: true } })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const label = (formData.get('label') as string | null) ?? null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = path.extname(file.name)
  const uniqueName = `attach-${randomUUID()}${ext}`
  const mimeType = file.type || 'application/octet-stream'

  let storedName = uniqueName
  let uploaded = false

  if (isSharePointConfigured()) {
    try {
      const result = await uploadToSharePoint(uniqueName, buffer, mimeType)
      if (result.itemId) { storedName = result.itemId; uploaded = true }
    } catch (err) { console.error('[attachments] SharePoint error:', err) }
  }

  if (!uploaded && isGCSConfigured()) {
    try {
      await uploadToGCS(uniqueName, buffer, mimeType)
      uploaded = true
    } catch (err) { console.error('[attachments] GCS error:', err) }
  }

  if (!uploaded) {
    try {
      const saved = await saveFile(uniqueName, buffer)
      storedName = saved.storedName
      uploaded = true
    } catch (err) { console.error('[attachments] local error:', err) }
  }

  if (!uploaded) return NextResponse.json({ error: 'File upload failed' }, { status: 500 })

  const attachment = await prisma.documentAttachment.create({
    data: {
      documentId: id,
      fileName: file.name,
      fileUrl: storedName,
      fileType: mimeType,
      fileSize: file.size,
      label,
      uploadedById: session.userId,
    },
    include: { uploadedBy: { select: { id: true, name: true, email: true } } },
  })

  // Audit log
  prisma.documentActivity.create({
    data: {
      documentId: id,
      userId: session.userId,
      action: 'ATTACHMENT_ADDED',
      details: `Attached: ${file.name}${label ? ` (${label})` : ''}`,
    },
  }).catch(() => {})

  return NextResponse.json(attachment, { status: 201 })
}
