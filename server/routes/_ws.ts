const onlineUsers = new Map<string, Set<string>>()
const peerRooms = new Map<string, string>()

export default defineWebSocketHandler({
  open(peer) {
    peer.subscribe('global')
    peer.send({ type: 'welcome', peerId: peer.id })
    peer.send({ type: 'online-count', count: peerRooms.size })
    peer.publish('global', { type: 'online-count', count: peerRooms.size })
  },

  async message(peer, message) {
    let data: {
      type: string
      roomId?: string
      content?: string
      name?: string
      before?: number
      limit?: number
    }
    try {
      data = message.json() as typeof data
    } catch {
      return
    }

    switch (data.type) {
      case 'join': {
        const roomId = data.roomId as string
        if (!roomId) return

        const prevRoom = peerRooms.get(peer.id)
        if (prevRoom) {
          onlineUsers.get(prevRoom)?.delete(peer.id)
          if (onlineUsers.get(prevRoom)?.size === 0) {
            onlineUsers.delete(prevRoom)
          }
          peer.unsubscribe(`room:${prevRoom}`)
          const prevUsers = [...(onlineUsers.get(prevRoom) || [])]
          peer.publish(`room:${prevRoom}`, {
            type: 'user-left',
            peerId: peer.id,
            onlineUsers: prevUsers,
          })
        }

        peerRooms.set(peer.id, roomId)
        if (!onlineUsers.has(roomId)) {
          onlineUsers.set(roomId, new Set())
        }
        onlineUsers.get(roomId)!.add(peer.id)
        peer.subscribe(`room:${roomId}`)

        const [messages, rooms] = await Promise.all([getMessages(roomId), getRooms()])
        peer.send({ type: 'history', messages })
        peer.send({ type: 'rooms', rooms })

        const users = [...onlineUsers.get(roomId)!]
        peer.publish(`room:${roomId}`, {
          type: 'user-joined',
          peerId: peer.id,
          onlineUsers: users,
        })
        peer.send({
          type: 'user-joined',
          peerId: peer.id,
          onlineUsers: users,
        })
        break
      }

      case 'chat': {
        const roomId = peerRooms.get(peer.id)
        if (!roomId || !data.content) return
        const msg = await addMessage(roomId, data.content, peer.id)
        peer.send({ type: 'chat', message: msg })
        peer.publish(`room:${roomId}`, { type: 'chat', message: msg })
        break
      }

      case 'typing': {
        const roomId = peerRooms.get(peer.id)
        if (!roomId) return
        peer.publish(`room:${roomId}`, {
          type: 'typing',
          peerId: peer.id,
        })
        break
      }

      case 'history': {
        if (!data.roomId) return
        const messages = await getMessages(data.roomId, data.before, data.limit)
        peer.send({ type: 'history', messages })
        break
      }

      case 'create-room': {
        if (!data.name) return
        const room = await createRoom(data.name)
        const rooms = await getRooms()
        peer.send({ type: 'room-created', room })
        peer.send({ type: 'rooms', rooms })
        peer.publish('global', { type: 'room-created', room })
        peer.publish('global', { type: 'rooms', rooms })
        break
      }
    }
  },

  close(peer) {
    const roomId = peerRooms.get(peer.id)
    if (roomId) {
      onlineUsers.get(roomId)?.delete(peer.id)
      if (onlineUsers.get(roomId)?.size === 0) {
        onlineUsers.delete(roomId)
      }
      peerRooms.delete(peer.id)
      peer.unsubscribe(`room:${roomId}`)
      const users = [...(onlineUsers.get(roomId) || [])]
      peer.publish(`room:${roomId}`, {
        type: 'user-left',
        peerId: peer.id,
        onlineUsers: users,
      })
    }
    peer.unsubscribe('global')
    peer.publish('global', { type: 'online-count', count: peerRooms.size })
  },
})
