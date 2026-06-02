export default defineNitroPlugin(async () => {
  const rooms = await getRooms()
  if (rooms.length === 0) {
    await createRoom('General')
    await createRoom('Random')
    await createRoom('DeepSeek')
  }
})
