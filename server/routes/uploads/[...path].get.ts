import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, resolve } from 'node:path'

const UPLOAD_DIR = resolve('uploads')

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

export default defineEventHandler((event) => {
  const pathParam = getRouterParam(event, 'path')
  if (!pathParam) throw createError({ statusCode: 404, message: 'Not found' })

  // Resolve and guard against path traversal outside UPLOAD_DIR
  const filePath = resolve(UPLOAD_DIR, pathParam)
  if (!filePath.startsWith(`${UPLOAD_DIR}/`)) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  const ext = extname(filePath).toLowerCase()
  setHeader(event, 'Content-Type', MIME_TYPES[ext] || 'application/octet-stream')
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return sendStream(event, createReadStream(filePath))
})
