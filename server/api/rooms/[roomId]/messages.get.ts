import { getMessages } from '../../../utils/storage'

export default defineEventHandler(async (event) => {
  const roomId = getRouterParam(event, 'roomId')
  if (!roomId) throw createError({ statusCode: 400, message: 'Missing roomId' })
  return getMessages(roomId)
})
