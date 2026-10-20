import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { saveFile } from '@/lib/file'
import { uploadToSharePoint, isSharePointConfigured } from '@/lib/sharepoint'
import { uploadToGCS, isGCSConfigured } from '@/lib/gcs'
import { randomUUID } from 'crypto'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let formData: FormData
    try {
      formData = await request.formData()
    } catch (err) {
      console.error('[upload] Failed to parse form data:', err)
      return NextResponse.json(
        { error: 'Could not read the uploaded file. Please try again.', details: [String(err)] },
        { status: 400 },
      )
    }

    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    // DLT-02: Primary document must be Word (.docx/.doc). PDF belongs in Attachments only.
    const fileExt = file.name.split('.').pop()?.toLowerCase()
    if (fileExt === 'pdf' || file.type === 'application/pdf') {
      return NextResponse.json(
        { error: 'PDF files cannot be the primary document. The master must be a Word file (.docx/.doc). Upload the signed PDF via the Attachments tab once the document is Approved.' },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = path.extname(file.name)
    const uuid = randomUUID()
    const uniqueName = `${uuid}${ext}`
    // SharePoint filename: human-readable with short unique prefix to avoid collisions
    const spFileName = `${uuid.slice(0, 8)}-${file.name.replace(/["*:<>?/\\|#%]/g, '_')}`
    const mimeType = file.type || 'application/octet-stream'

    const errors: string[] = []

    // 1. SharePoint (if configured)
    if (isSharePointConfigured()) {
      try {
        const result = await uploadToSharePoint(spFileName, buffer, mimeType)
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
        errors.push('SharePoint: upload succeeded but returned no item ID or URL')
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
      { status: 500 },
    )
  } catch (err) {
    // Top-level safety net — catches any unhandled exception so the client always
    // gets a proper JSON response instead of a raw Next.js 500 HTML page.
    console.error('[upload] Unexpected unhandled error:', err)
    return NextResponse.json(
      { error: 'An unexpected server error occurred during upload.', details: [String(err)] },
      { status: 500 },
    )
  }
}
