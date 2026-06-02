import { writeFile, unlink, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

export async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true })
  }
}

export async function saveFile(file: File): Promise<{ storedName: string; size: number }> {
  await ensureUploadDir()
  const ext = path.extname(file.name)
  const storedName = `${randomUUID()}${ext}`
  const filePath = path.join(UPLOAD_DIR, storedName)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)
  return { storedName, size: file.size }
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
