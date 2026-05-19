import type { ClientMessage } from '~/types/chat'

export function useChat() {
  const store = useChatStore()
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  function connect() {
    if (!import.meta.client) return
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/api/chat`

    ws = new WebSocket(url)

    ws.onopen = () => {
      store.connected = true
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
      reconnectTimer = setTimeout(connect, 3000)
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
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    ws?.close()
    ws = null
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
