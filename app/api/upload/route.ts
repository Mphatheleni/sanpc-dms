import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { saveFile } from '@/lib/file'
import { uploadToSharePoint, isSharePointConfigured } from '@/lib/sharepoint'
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

  // SharePoint via Graph API
  if (isSharePointConfigured()) {
    try {
      const result = await uploadToSharePoint(uniqueName, buffer, file.type || 'application/octet-stream')
      if (result.itemId && result.webUrl) {
        console.log(`[upload] SharePoint upload success: ${result.webUrl}`)
        return NextResponse.json({
          storedName: result.itemId,
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileSize: file.size,
          sharePointUrl: result.webUrl,
          sharePointItemId: result.itemId,
        })
      }
    } catch (err) {
      console.error('[upload] SharePoint upload error, falling back to local:', err)
    }
  }

  // Local storage fallback
  const { storedName, size } = await saveFile(uniqueName, buffer)
  return NextResponse.json({
    storedName,
    fileName: file.name,
    fileType: file.type || 'application/octet-stream',
    fileSize: size,
    sharePointUrl: null,
    sharePointItemId: null,
  })
}
