import { writeFile, unlink, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

export async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true })
  }
}

export async function saveFile(storedName: string, buffer: Buffer): Promise<{ storedName: string; size: number }> {
  await ensureUploadDir()
  const filePath = path.join(UPLOAD_DIR, storedName)
  await writeFile(filePath, buffer)
  return { storedName, size: buffer.length }
}

export async function deleteFile(storedName: string): Promise<void> {
  const filePath = path.join(UPLOAD_DIR, storedName)
  try {
    await unlink(filePath)
  } catch {
    // Ignore if file doesn't exist
  }
}

export function getFilePath(storedName: string): string {
  return path.join(UPLOAD_DIR, storedName)
}
