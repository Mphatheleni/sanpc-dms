import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getFilePath } from '@/lib/file'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, version } = await params
  const versionNumber = parseInt(version, 10)

  const docVersion = await prisma.documentVersion.findFirst({
    where: { documentId: id, versionNumber },
  })

  if (!docVersion) return NextResponse.json({ error: 'Version not found' }, { status: 404 })

  const filePath = getFilePath(docVersion.fileUrl)
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 })
  }

  const buffer = await readFile(filePath)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': docVersion.fileType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${docVersion.fileName}"`,
      'Content-Length': buffer.length.toString(),
    },
  })
}
