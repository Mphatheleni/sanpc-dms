import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { saveFile } from '@/lib/file'
import { isSharePointConfigured, uploadToSharePoint } from '@/lib/sharepoint'
import { randomUUID } from 'crypto'
import path from 'path'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (isSharePointConfigured()) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const ext = path.extname(file.name)
      const uniqueName = `${randomUUID()}${ext}`
      const result = await uploadToSharePoint(uniqueName, buffer, file.type || 'application/octet-stream')
      return NextResponse.json({
        storedName: result.itemId,       // itemId used as storedName for SharePoint files
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        sharePointUrl: result.webUrl,
        sharePointItemId: result.itemId,
      })
    } catch (err) {
      console.error('[upload] SharePoint upload failed, falling back to local:', err)
    }
  }

  // Local storage fallback
  const { storedName, size } = await saveFile(file)
  return NextResponse.json({
    storedName,
    fileName: file.name,
    fileType: file.type,
    fileSize: size,
    sharePointUrl: null,
    sharePointItemId: null,
  })
}
