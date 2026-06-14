import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const UPLOAD_DIR = resolve('uploads')
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export async function saveUploadedFile(file: {
  data: ArrayBuffer
  type: string
  name: string
}): Promise<{ url: string; filename: string }> {
  if (file.data.byteLength > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${file.data.byteLength} bytes (max ${MAX_FILE_SIZE})`)
  }

  const ext = file.name.split('.').pop() || 'bin'
  const filename = `${randomUUID()}.${ext}`
  const filePath = join(UPLOAD_DIR, filename)

  await mkdir(UPLOAD_DIR, { recursive: true })
  await writeFile(filePath, Buffer.from(file.data))

  const url = `/uploads/${filename}`
  return { url, filename }
}
