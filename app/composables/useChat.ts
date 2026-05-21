import type { ClientMessage } from '~/types/chat'

const CLIENT_ID_KEY = 'chat-client-id'

function generateId(): string {
  const bytes = window.crypto.getRandomValues(new Uint8Array(1))
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (Number(c) ^ (bytes[0]! & (15 >> (Number(c) / 4)))).toString(16),
  )
}

function getOrCreateClientId(): string {
  if (!import.meta.client) return ''
  let id = localStorage.getItem(CLIENT_ID_KEY)
  if (!id) {
    id = generateId()
    localStorage.setItem(CLIENT_ID_KEY, id)
  }
  return id
}

export function useChat() {
  const store = useChatStore()
  let ws: WebSocket | null = null
  let reconnectTimer: number | null = null

  function connect() {
    if (!import.meta.client) return
    const clientId = getOrCreateClientId()
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/_ws?clientId=${clientId}`

    ws = new WebSocket(url)

    ws.onopen = () => {
      store.connected = true
      // Auto-join current room after (re)connect
      if (store.currentRoomId) {
        send({ type: 'join', roomId: store.currentRoomId })
      }
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        store.handleMessage(msg)
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      store.connected = false
      reconnectTimer = window.setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      ws?.close()
    }
  }

  function send(msg: ClientMessage) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }

  function joinRoom(roomId: string) {
    store.currentRoomId = roomId
    send({ type: 'join', roomId })
  }

  function sendMessage(content: string) {
    send({ type: 'chat', content })
  }

  function sendTyping() {
    send({ type: 'typing' })
  }

  function requestHistory(roomId: string, before?: number, limit?: number) {
    send({ type: 'history', roomId, before, limit })
  }

  function createRoom(name: string) {
    send({ type: 'create-room', name })
  }

  function disconnect() {
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (ws) {
      ws.onclose = null
      ws.close()
      ws = null
    }
  }

  onMounted(() => connect())
  onUnmounted(() => disconnect())

  return {
    joinRoom,
    sendMessage,
    sendTyping,
    requestHistory,
    createRoom,
    disconnect,
  }
}
