import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { saveFile } from '@/lib/file'
import { uploadToSharePoint, replaceFileInSharePoint, isSharePointConfigured } from '@/lib/sharepoint'
import { uploadToGCS, isGCSConfigured } from '@/lib/gcs'
import { sendDocumentUpdatedEmail } from '@/lib/email'
import { randomUUID } from 'crypto'
import path from 'path'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true, title: true, status: true, version: true,
      fileUrl: true, fileName: true, fileType: true, fileSize: true,
      uploadedById: true, sharePointUrl: true,
      uploadedBy: { select: { name: true } },
      reviews: {
        where: { status: 'IN_PROGRESS' },
        include: { reviewer: { select: { name: true, email: true } } },
      },
    },
  })

  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (document.uploadedById !== session.userId && session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const allowedStatuses = ['UPDATING', 'REVIEW_COMPLETE', 'IN_REVIEW', 'FINAL_DRAFT', 'PENDING_APPROVAL', 'REJECTED', 'CHANGES_REQUESTED']
  if (!allowedStatuses.includes(document.status)) {
    return NextResponse.json({ error: 'File replacement not allowed at this stage' }, { status: 400 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // Snapshot current file as a DocumentVersion
  await prisma.documentVersion.create({
    data: {
      documentId: id,
      versionNumber: document.version,
      fileUrl: document.fileUrl,
      fileName: document.fileName,
      fileType: document.fileType,
      fileSize: document.fileSize,
      uploadedById: document.uploadedById,
    },
  })

  // Upload new file using same storage pipeline as /api/upload
  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = path.extname(file.name)
  const uniqueName = `${randomUUID()}${ext}`
  const mimeType = file.type || 'application/octet-stream'

  let storedName = uniqueName
  let newSharePointUrl: string | null = null
  let uploaded = false

  if (isSharePointConfigured()) {
    // Prefer in-place update — keeps the same SharePoint URL so old email links stay valid
    try {
      await replaceFileInSharePoint(document.fileUrl, buffer, mimeType)
      storedName = document.fileUrl  // item ID unchanged
      // sharePointUrl unchanged — old links continue to work
      uploaded = true
    } catch {
      // fileUrl may not be a SharePoint item ID (e.g. doc uploaded before SharePoint was configured)
      // Fall back to uploading a new file
      try {
        const result = await uploadToSharePoint(file.name || uniqueName, buffer, mimeType)
        if (result.itemId && result.webUrl) {
          storedName = result.itemId
          newSharePointUrl = result.webUrl
          uploaded = true
        }
      } catch (err) {
        console.error('[amend-file] SharePoint error:', err)
      }
    }
  }

  if (!uploaded && isGCSConfigured()) {
    try {
      await uploadToGCS(uniqueName, buffer, mimeType)
      uploaded = true
    } catch (err) {
      console.error('[amend-file] GCS error:', err)
    }
  }

  if (!uploaded) {
    try {
      const saved = await saveFile(uniqueName, buffer)
      storedName = saved.storedName
      uploaded = true
    } catch (err) {
      console.error('[amend-file] local save error:', err)
    }
  }

  if (!uploaded) {
    return NextResponse.json({ error: 'File upload failed — no storage backend succeeded' }, { status: 500 })
  }

  const newVersion = document.version + 1
  await prisma.document.update({
    where: { id },
    data: {
      fileUrl: storedName,
      fileName: file.name,
      fileType: mimeType,
      fileSize: file.size,
      version: newVersion,
      ...(newSharePointUrl ? { sharePointUrl: newSharePointUrl } : {}),
    },
  })

  prisma.documentActivity.create({
    data: {
      documentId: id,
      userId: session.userId,
      action: 'AMENDED',
      details: `Uploaded revised document as v${newVersion}: ${file.name}`,
    },
  }).catch(() => {})

  // Notify all active reviewers/approvers that a new version is available
  if (document.reviews.length > 0) {
    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    await Promise.all(
      document.reviews.map((r) =>
        sendDocumentUpdatedEmail({
          toEmail: r.reviewer.email,
          toName: r.reviewer.name,
          documentTitle: document.title,
          documentUrl: `${appUrl}/documents/${id}`,
          sharePointUrl: newSharePointUrl ?? document.sharePointUrl,
          uploaderName: document.uploadedBy.name,
        }).catch((e) => console.error('[amend-file] notification email error:', e))
      )
    )
  }

  const updated = await prisma.document.findUnique({
    where: { id },
    include: {
      uploadedBy: { select: { id: true, name: true, email: true, role: true } },
      metadata: true,
      reviews: {
        include: { reviewer: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { order: 'asc' },
      },
      comments: {
        include: { author: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  return NextResponse.json(updated)
}
