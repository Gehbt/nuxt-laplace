const onlineUsers = new Map<string, Set<string>>()
const peerRooms = new Map<string, string>()
const peerClientIds = new Map<string, string>()

function getUserId(peer: { id: string }): string {
  return peerClientIds.get(peer.id) || peer.id
}

function mapUsers(users: string[]): string[] {
  return users.map((id) => peerClientIds.get(id) || id)
}

export default defineWebSocketHandler({
  open(peer) {
    const url = new URL(peer.request?.url || '', 'http://localhost')
    const clientId = url.searchParams.get('clientId') || peer.id
    peerClientIds.set(peer.id, clientId)

    peer.subscribe('global')
    peer.send({ type: 'welcome', peerId: getUserId(peer) })
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

    const userId = getUserId(peer)

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
          const prevUsers = mapUsers([...(onlineUsers.get(prevRoom) || [])])
          peer.publish(`room:${prevRoom}`, {
            type: 'user-left',
            peerId: userId,
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

        const users = mapUsers([...onlineUsers.get(roomId)!])
        peer.publish(`room:${roomId}`, {
          type: 'user-joined',
          peerId: userId,
          onlineUsers: users,
        })
        peer.send({
          type: 'user-joined',
          peerId: userId,
          onlineUsers: users,
        })
        break
      }

      case 'chat': {
        const roomId = peerRooms.get(peer.id)
        if (!roomId || !data.content) return
        const msg = await addMessage(roomId, data.content, userId)
        peer.send({ type: 'chat', message: msg })
        peer.publish(`room:${roomId}`, { type: 'chat', message: msg })
        break
      }

      case 'typing': {
        const roomId = peerRooms.get(peer.id)
        if (!roomId) return
        peer.publish(`room:${roomId}`, {
          type: 'typing',
          peerId: userId,
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
    const userId = getUserId(peer)
    if (roomId) {
      onlineUsers.get(roomId)?.delete(peer.id)
      if (onlineUsers.get(roomId)?.size === 0) {
        onlineUsers.delete(roomId)
      }
      peerRooms.delete(peer.id)
      peer.unsubscribe(`room:${roomId}`)
      const users = mapUsers([...(onlineUsers.get(roomId) || [])])
      peer.publish(`room:${roomId}`, {
        type: 'user-left',
        peerId: userId,
        onlineUsers: users,
      })
    }
    peerClientIds.delete(peer.id)
    peer.unsubscribe('global')
    peer.publish('global', { type: 'online-count', count: peerRooms.size })
  },
})
