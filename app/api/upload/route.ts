import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { saveFile } from '@/lib/file'
import { uploadToSharePoint, isSharePointConfigured } from '@/lib/sharepoint'
import { uploadToGCS, isGCSConfigured } from '@/lib/gcs'
import { randomUUID } from 'crypto'
import path from 'path'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = path.extname(file.name)
  const uniqueName = `${randomUUID()}${ext}`
  const mimeType = file.type || 'application/octet-stream'

  const errors: string[] = []

  // 1. SharePoint (if configured)
  if (isSharePointConfigured()) {
    try {
      const result = await uploadToSharePoint(uniqueName, buffer, mimeType)
      if (result.itemId && result.webUrl) {
        console.log(`[upload] SharePoint success: ${result.webUrl}`)
        return NextResponse.json({
          storedName: result.itemId,
          fileName: file.name,
          fileType: mimeType,
          fileSize: file.size,
          sharePointUrl: result.webUrl,
          sharePointItemId: result.itemId,
        })
      }
    } catch (err) {
      const msg = String(err)
      console.error('[upload] SharePoint error:', msg)
      errors.push(`SharePoint: ${msg}`)
    }
  }

  // 2. Google Cloud Storage fallback
  if (isGCSConfigured()) {
    try {
      await uploadToGCS(uniqueName, buffer, mimeType)
      console.log(`[upload] GCS success: ${uniqueName}`)
      return NextResponse.json({
        storedName: uniqueName,
        fileName: file.name,
        fileType: mimeType,
        fileSize: file.size,
        sharePointUrl: null,
        sharePointItemId: null,
      })
    } catch (err) {
      const msg = String(err)
      console.error('[upload] GCS error:', msg)
      errors.push(`GCS: ${msg}`)
    }
  }

  // 3. Local filesystem (dev only — fails on Cloud Run)
  try {
    const { storedName, size } = await saveFile(uniqueName, buffer)
    return NextResponse.json({
      storedName,
      fileName: file.name,
      fileType: mimeType,
      fileSize: size,
      sharePointUrl: null,
      sharePointItemId: null,
    })
  } catch (err) {
    errors.push(`Local: ${String(err)}`)
  }

  console.error('[upload] All storage backends failed:', errors)
  return NextResponse.json(
    { error: 'File upload failed', details: errors },
    { status: 500 }
  )
}
