import { prisma } from '@/lib/db'

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  documentId?: string,
) {
  try {
    await prisma.notification.create({
      data: { userId, type, title, message, documentId },
    })
  } catch {
    // Fire-and-forget — never throws
  }
}
