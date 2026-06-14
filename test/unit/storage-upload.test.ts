import { existsSync, rmSync, statSync } from 'node:fs'
import { afterEach, describe, it, expect } from 'vitest'

import { saveUploadedFile } from '../../server/utils/storage-upload'

const MAX_FILE_SIZE = 10 * 1024 * 1024

describe('saveUploadedFile', () => {
  const writtenFiles: string[] = []

  afterEach(() => {
    for (const f of writtenFiles) {
      if (existsSync(f)) rmSync(f)
    }
    writtenFiles.length = 0
  })

  it('throws when the file exceeds the 10MB limit', async () => {
    const oversized = {
      data: new ArrayBuffer(MAX_FILE_SIZE + 1),
      type: 'image/png',
      name: 'big.png',
    }
    await expect(saveUploadedFile(oversized)).rejects.toThrow(/File too large/)
  })

  it('saves a valid file and returns a /uploads/ url', async () => {
    const data = new TextEncoder().encode('fake-png-bytes').buffer
    const result = await saveUploadedFile({ data, type: 'image/png', name: 'photo.png' })
    expect(result.url).toMatch(/^\/uploads\/[a-f0-9-]+\.png$/)
    expect(result.filename).toMatch(/\.png$/)

    const path = `uploads/${result.filename}`
    writtenFiles.push(path)
    expect(existsSync(path)).toBe(true)
    expect(statSync(path).size).toBeGreaterThan(0)
  })

  it('uses the last extension of the filename', async () => {
    const data = new TextEncoder().encode('x').buffer
    const result = await saveUploadedFile({ data, type: 'image/png', name: 'archive.tar.gz' })
    expect(result.url).toMatch(/\.gz$/)
    writtenFiles.push(`uploads/${result.filename}`)
  })
})
