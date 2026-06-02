import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getFilePath } from '@/lib/file'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const document = await prisma.document.findUnique({ where: { id } })
  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const filePath = getFilePath(document.fileUrl)
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const buffer = await readFile(filePath)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': document.fileType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${document.fileName}"`,
      'Content-Length': buffer.length.toString(),
    },
  })
}
