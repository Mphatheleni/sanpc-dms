/**
 * DLT-09: DELETE a specific attachment.
 * Only DOCUMENT_MANAGER / ADMIN can remove attachments.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.role !== 'DOCUMENT_MANAGER' && session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Document Controller only' }, { status: 403 })
  }

  const { id, attachmentId } = await params
  const attachment = await prisma.documentAttachment.findUnique({
    where: { id: attachmentId },
  })

  if (!attachment || attachment.documentId !== id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.documentAttachment.delete({ where: { id: attachmentId } })

  prisma.documentActivity.create({
    data: {
      documentId: id,
      userId: session.userId,
      action: 'ATTACHMENT_REMOVED',
      details: `Removed attachment: ${attachment.fileName}`,
    },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
