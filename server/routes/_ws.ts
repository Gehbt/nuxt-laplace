import type { DeepSeekLanguageModelOptions } from '@ai-sdk/deepseek'

import { streamText } from 'ai'
import { styleText } from 'node:util'

import type { MessagePart } from '../../app/types/chat'

import { getDeepSeekProvider } from '../utils/ai'
import { getMessages, addMessage } from '../utils/storage'

// roomId → Map<clientId, peerCount>
const roomClientCounts = new Map<string, Map<string, number>>()
const peerRooms = new Map<string, string>()
const peerClientIds = new Map<string, string>()
// clientId → peerCount (across all tabs)
const clientPeerCounts = new Map<string, number>()
// peer.id → peer
const allPeers = new Map<string, { id: string; send: (data: unknown) => void }>()

function getUserId(peer: { id: string }): string {
  return peerClientIds.get(peer.id) || peer.id
}

function getOnlineUsers(roomId: string): string[] {
  return [...(roomClientCounts.get(roomId)?.keys() || [])]
}

function addClientToRoom(roomId: string, clientId: string) {
  if (!roomClientCounts.has(roomId)) {
    roomClientCounts.set(roomId, new Map())
  }
  const counts = roomClientCounts.get(roomId)!
  counts.set(clientId, (counts.get(clientId) || 0) + 1)
}

function removeClientFromRoom(roomId: string, clientId: string) {
  const counts = roomClientCounts.get(roomId)
  if (!counts) return
  const count = counts.get(clientId)
  if (!count) return
  if (count <= 1) {
    counts.delete(clientId)
    if (counts.size === 0) {
      roomClientCounts.delete(roomId)
    }
  } else {
    counts.set(clientId, count - 1)
  }
}

function totalOnlineCount(): number {
  return clientPeerCounts.size
}

function broadcastToRoom(roomId: string, data: unknown, excludePeerId?: string) {
  for (const [peerId, room] of peerRooms) {
    if (peerId !== excludePeerId && room === roomId) {
      allPeers.get(peerId)?.send(data)
    }
  }
}

function broadcastGlobal(data: unknown, excludePeerId?: string) {
  for (const [peerId, peer] of allPeers) {
    if (peerId !== excludePeerId) {
      peer.send(data)
    }
  }
}

const activeAiStreams = new Map<string, AbortController>()
const activeAiMsgIds = new Map<string, string>()

const AI_PEER_ID = 'ai:deepseek'
const AI_ROOM_ID = 'deepseek'
const AI_CONTEXT_LIMIT = 20

async function handleAiChat(
  roomId: string,
  llmOptions: DeepSeekLanguageModelOptions = {
    thinking: { type: 'enabled' },
    reasoningEffort: 'high',
  },
) {
  if (roomId !== AI_ROOM_ID) return

  // Abort any existing stream for this room
  const existing = activeAiStreams.get(roomId)
  if (existing) {
    existing.abort()
    activeAiStreams.delete(roomId)
  }

  const controller = new AbortController()
  activeAiStreams.set(roomId, controller)

  try {
    const history = await getMessages(roomId, undefined, AI_CONTEXT_LIMIT)
    const contextMessages = history.map((msg) => {
      if (msg.peerId === AI_PEER_ID) {
        const text = msg.content
          .filter((p): p is Extract<MessagePart, { type: 'text' }> => p.type === 'text')
          .map((p) => p.text)
          .join('')
        return { role: 'assistant' as const, content: text }
      }

      const parts = msg.content.map((part) => {
        if (part.type === 'image') {
          return { type: 'image' as const, image: part.url }
        }
        return { type: 'text' as const, text: part.text }
      })

      if (parts.length === 1) {
        const single = parts[0]!
        if (single.type === 'text') {
          return { role: 'user' as const, content: single.text }
        }
      }
      return { role: 'user' as const, content: parts }
    })

    const aiMsgId = crypto.randomUUID()
    const startTime = Date.now()

    activeAiMsgIds.set(roomId, aiMsgId)

    broadcastToRoom(roomId, {
      type: 'ai-start',
      id: aiMsgId,
      peerId: AI_PEER_ID,
      roomId,
      timestamp: startTime,
    })

    const provider = getDeepSeekProvider()
    let fullContent = ''

    const result = streamText({
      model: provider('deepseek-v4-pro'),
      system: 'You are a helpful assistant.',
      messages: contextMessages,
      abortSignal: controller.signal,
      providerOptions: {
        deepseek: llmOptions satisfies DeepSeekLanguageModelOptions,
      },
    })

    for await (const chunk of result.textStream) {
      if (controller.signal.aborted) break
      fullContent += chunk
      broadcastToRoom(roomId, {
        type: 'ai-chunk',
        id: aiMsgId,
        text: chunk,
        roomId,
        timestamp: Date.now(),
      })
    }

    if (!controller.signal.aborted) {
      broadcastToRoom(roomId, {
        type: 'ai-end',
        id: aiMsgId,
        roomId,
        timestamp: Date.now(),
      })

      // Store the complete AI message in DB
      await addMessage(roomId, [{ type: 'text', text: fullContent }], AI_PEER_ID)
    }
  } catch (err) {
    if (!controller.signal.aborted) {
      console.error('AI stream error:', err)
    }
  } finally {
    activeAiStreams.delete(roomId)
    activeAiMsgIds.delete(roomId)
  }
}

export default defineWebSocketHandler({
  open(peer) {
    const url = new URL(peer.request?.url || '', 'http://localhost')
    const clientId = url.searchParams.get('clientId') || peer.id
    peerClientIds.set(peer.id, clientId)
    clientPeerCounts.set(clientId, (clientPeerCounts.get(clientId) || 0) + 1)
    allPeers.set(peer.id, peer)

    peer.send({ type: 'welcome', peerId: getUserId(peer) })
    peer.send({ type: 'online-count', count: totalOnlineCount() })
    broadcastGlobal({ type: 'online-count', count: totalOnlineCount() }, peer.id)
  },

  async message(peer, message) {
    let data: {
      type: string
      roomId?: string
      content?: MessagePart[]
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
          removeClientFromRoom(prevRoom, userId)
          broadcastToRoom(
            prevRoom,
            {
              type: 'user-left',
              peerId: userId,
              onlineUsers: getOnlineUsers(prevRoom),
            },
            peer.id,
          )
          peer.send({
            type: 'room-left',
            roomId: prevRoom,
            peerId: userId,
          })
        }

        peerRooms.set(peer.id, roomId)
        addClientToRoom(roomId, userId)

        const [messages, rooms] = await Promise.all([getMessages(roomId), getRooms()])
        peer.send({ type: 'history', messages })
        peer.send({ type: 'rooms', rooms })

        const users = getOnlineUsers(roomId)
        broadcastToRoom(
          roomId,
          {
            type: 'user-joined',
            peerId: userId,
            onlineUsers: users,
          },
          peer.id,
        )
        peer.send({
          type: 'user-joined',
          peerId: userId,
          onlineUsers: users,
        })
        break
      }

      case 'chat': {
        const roomId = peerRooms.get(peer.id)
        if (!roomId || !data.content || data.content.length === 0) return
        const msg = await addMessage(roomId, data.content, userId)
        peer.send({ type: 'chat', message: msg })
        broadcastToRoom(roomId, { type: 'chat', message: msg }, peer.id)

        // Trigger AI response for DeepSeek room
        if (roomId === AI_ROOM_ID) {
          handleAiChat(roomId)
        }
        break
      }

      case 'stop-ai': {
        const roomId = peerRooms.get(peer.id)
        if (!roomId) return
        const activeController = activeAiStreams.get(roomId)
        if (activeController) {
          activeController.abort()
          const aiMsgId = activeAiMsgIds.get(roomId) || ''
          activeAiStreams.delete(roomId)
          activeAiMsgIds.delete(roomId)
          broadcastToRoom(roomId, {
            type: 'ai-stop',
            id: aiMsgId,
            roomId,
            timestamp: Date.now(),
          })
        }
        break
      }

      case 'typing': {
        const roomId = peerRooms.get(peer.id)
        if (!roomId) return
        broadcastToRoom(
          roomId,
          {
            type: 'typing',
            peerId: userId,
          },
          peer.id,
        )
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
        broadcastGlobal({ type: 'room-created', room }, peer.id)
        broadcastGlobal({ type: 'rooms', rooms }, peer.id)
        break
      }
    }
  },

  close(peer) {
    const roomId = peerRooms.get(peer.id)
    const userId = getUserId(peer)
    if (roomId) {
      removeClientFromRoom(roomId, userId)
      peerRooms.delete(peer.id)
      broadcastToRoom(
        roomId,
        {
          type: 'user-left',
          peerId: userId,
          onlineUsers: getOnlineUsers(roomId),
        },
        peer.id,
      )
    }
    peerClientIds.delete(peer.id)
    const pCount = clientPeerCounts.get(userId)
    if (pCount !== undefined) {
      if (pCount <= 1) clientPeerCounts.delete(userId)
      else clientPeerCounts.set(userId, pCount - 1)
    }
    allPeers.delete(peer.id)
    broadcastGlobal({ type: 'online-count', count: totalOnlineCount() }, peer.id)
  },
  error(peer, error) {
    console.error(styleText('red', 'Error in WebSocket connection: ' + error.message))
  },
})
