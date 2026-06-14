import { saveUploadedFile } from '../utils/storage-upload'

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

export default defineEventHandler(async (event) => {
  const formData = await readFormData(event)
  const file = formData.get('file')

  if (!file || !(file instanceof File)) {
    throw createError({ statusCode: 400, message: 'No file provided' })
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw createError({
      statusCode: 400,
      message: `Invalid file type: ${file.type}. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
    })
  }

  const data = await file.arrayBuffer()
  const result = await saveUploadedFile({
    data,
    type: file.type,
    name: file.name,
  })

  return { url: result.url }
})
