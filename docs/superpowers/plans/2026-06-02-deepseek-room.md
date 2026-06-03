# DeepSeek AI Chat Room Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a DeepSeek AI room to the existing WebSocket chat system where every user message gets a streaming AI response.

**Architecture:** Server-driven — the WebSocket handler detects messages in the `deepseek` room, calls DeepSeek API via `streamText`, and pushes `ai-start`/`ai-chunk`/`ai-end` messages back through WebSocket. Client renders AI messages with the same components, plus visual distinction and a stop button.

**Tech Stack:** Nuxt 4, Nitro WebSocket (crossws), Vercel AI SDK (`@ai-sdk/anthropic`), Pinia, Nuxt UI

---

### Task 1: Add AI Message Types to Chat Types

**Files:**

- Modify: `app/types/chat.ts`

- [ ] **Step 1: Add `stop-ai` to ClientMessage and `ai-start`/`ai-chunk`/`ai-end`/`ai-stop` to ServerMessage**

```ts
// app/types/chat.ts — full replacement
export interface ChatMessage {
  id: string
  content: string
  peerId: string
  timestamp: number
}

export interface Room {
  id: string
  name: string
}

export type ClientMessage =
  | { type: 'join'; roomId: string }
  | { type: 'chat'; content: string }
  | { type: 'typing' }
  | { type: 'history'; roomId: string; before?: number; limit?: number }
  | { type: 'create-room'; name: string }
  | { type: 'stop-ai' }

export type ServerMessage =
  | { type: 'welcome'; peerId: string }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'typing'; peerId: string }
  | { type: 'user-joined'; peerId: string; onlineUsers: string[] }
  | { type: 'user-left'; peerId: string; onlineUsers: string[] }
  | { type: 'history'; messages: ChatMessage[] }
  | { type: 'room-created'; room: Room }
  | { type: 'rooms'; rooms: Room[] }
  | { type: 'online-count'; count: number }
  | { type: 'room-left'; roomId: string; peerId: string }
  | { type: 'ai-start'; id: string; peerId: 'ai:deepseek'; roomId: string; timestamp: number }
  | { type: 'ai-chunk'; id: string; text: string; roomId: string; timestamp: number }
  | { type: 'ai-end'; id: string; roomId: string; timestamp: number }
  | { type: 'ai-stop'; id: string; roomId: string; timestamp: number }
```

- [ ] **Step 2: Run typecheck to verify**

Run: `bun run typecheck`
Expected: PASS (no type errors)

- [ ] **Step 3: Commit**

```bash
git add app/types/chat.ts
git commit -m "feat(chat): add AI streaming message types to chat protocol"
```

---

### Task 2: Create Shared AI Provider Utility + Refactor deepseek-chat.ts

**Files:**

- Create: `server/utils/ai.ts`
- Modify: `server/api/deepseek-chat.ts`

- [ ] **Step 1: Create `server/utils/ai.ts`**

```ts
import { createAnthropic } from '@ai-sdk/anthropic'

export function getDeepSeekProvider() {
  const { deepseekApiKey, deepseekBaseUrl } = useRuntimeConfig()

  if (!deepseekApiKey) throw new Error('Missing DEEPSEEK_API_KEY')

  return createAnthropic({
    baseURL: deepseekBaseUrl || undefined,
    apiKey: deepseekApiKey,
  })
}
```

- [ ] **Step 2: Refactor `server/api/deepseek-chat.ts` to use shared provider**

```ts
import type { UIMessage } from 'ai'
import type { H3Event } from 'h3'
import { streamText, convertToModelMessages } from 'ai'
import { getDeepSeekProvider } from '../utils/ai'

export default defineLazyEventHandler(async () => {
  const anthropic = getDeepSeekProvider()

  return defineEventHandler(async (event: H3Event<EventHandlerRequest>) => {
    const { messages }: { messages: UIMessage[] } = await readBody(event)

    const result = streamText({
      model: anthropic('deepseek-v4-pro'),
      system: 'You are a helpful assistant.',
      messages: await convertToModelMessages(messages),
    })

    return result.toUIMessageStreamResponse()
  })
})
```

- [ ] **Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add server/utils/ai.ts server/api/deepseek-chat.ts
git commit -m "feat(ai): extract shared DeepSeek provider utility"
```

---

### Task 3: Update Chat Store for AI Message Handling (TDD)

**Files:**

- Modify: `app/stores/chat.ts`
- Create: `test/nuxt/chat-store-ai.test.ts`

- [ ] **Step 1: Write failing tests for AI message handling**

```ts
// test/nuxt/chat-store-ai.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from '../../app/stores/chat'

describe('chat store — AI message handling', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function storeWithRoom(roomId: string) {
    const store = useChatStore()
    store.currentRoomId = roomId
    store.messages[roomId] = []
    return store
  }

  describe('ai-start', () => {
    it('inserts an empty AI message and sets isAiGenerating', () => {
      const store = storeWithRoom('deepseek')

      store.handleMessage({
        type: 'ai-start',
        id: 'msg-1',
        peerId: 'ai:deepseek',
        roomId: 'deepseek',
        timestamp: 1000,
      })

      expect(store.isAiGenerating).toBe(true)
      expect(store.currentMessages).toHaveLength(1)
      expect(store.currentMessages[0]).toEqual({
        id: 'msg-1',
        content: '',
        peerId: 'ai:deepseek',
        timestamp: 1000,
      })
    })
  })

  describe('ai-chunk', () => {
    it('appends text to the matching AI message', () => {
      const store = storeWithRoom('deepseek')

      store.handleMessage({
        type: 'ai-start',
        id: 'msg-1',
        peerId: 'ai:deepseek',
        roomId: 'deepseek',
        timestamp: 1000,
      })

      store.handleMessage({
        type: 'ai-chunk',
        id: 'msg-1',
        text: 'Hello',
        roomId: 'deepseek',
        timestamp: 1001,
      })

      store.handleMessage({
        type: 'ai-chunk',
        id: 'msg-1',
        text: ' world',
        roomId: 'deepseek',
        timestamp: 1002,
      })

      expect(store.currentMessages).toHaveLength(1)
      expect(store.currentMessages[0].content).toBe('Hello world')
    })

    it('ignores chunks for unknown message ids', () => {
      const store = storeWithRoom('deepseek')

      store.handleMessage({
        type: 'ai-chunk',
        id: 'unknown',
        text: 'orphan',
        roomId: 'deepseek',
        timestamp: 1001,
      })

      expect(store.currentMessages).toHaveLength(0)
    })
  })

  describe('ai-end', () => {
    it('sets isAiGenerating to false', () => {
      const store = storeWithRoom('deepseek')

      store.handleMessage({
        type: 'ai-start',
        id: 'msg-1',
        peerId: 'ai:deepseek',
        roomId: 'deepseek',
        timestamp: 1000,
      })
      expect(store.isAiGenerating).toBe(true)

      store.handleMessage({
        type: 'ai-end',
        id: 'msg-1',
        roomId: 'deepseek',
        timestamp: 2000,
      })
      expect(store.isAiGenerating).toBe(false)
      // Message should still exist with accumulated content
      expect(store.currentMessages).toHaveLength(1)
    })
  })

  describe('ai-stop', () => {
    it('removes the incomplete AI message and sets isAiGenerating to false', () => {
      const store = storeWithRoom('deepseek')

      store.handleMessage({
        type: 'ai-start',
        id: 'msg-1',
        peerId: 'ai:deepseek',
        roomId: 'deepseek',
        timestamp: 1000,
      })

      store.handleMessage({
        type: 'ai-chunk',
        id: 'msg-1',
        text: 'Partial',
        roomId: 'deepseek',
        timestamp: 1001,
      })

      store.handleMessage({
        type: 'ai-stop',
        id: 'msg-1',
        roomId: 'deepseek',
        timestamp: 1500,
      })

      expect(store.isAiGenerating).toBe(false)
      expect(store.currentMessages).toHaveLength(0)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test:nuxt -- test/nuxt/chat-store-ai.test.ts`
Expected: FAIL — `store.isAiGenerating` is undefined, `ai-start`/`ai-chunk`/`ai-end`/`ai-stop` cases not handled in store

- [ ] **Step 3: Implement store changes**

```ts
// app/stores/chat.ts — full replacement
import { defineStore } from 'pinia'
import type { ChatMessage, Room, ServerMessage } from '~/types/chat'

export const useChatStore = defineStore('chat', {
  state: () => ({
    peerId: '' as string,
    currentRoomId: '' as string,
    rooms: [] as Room[],
    messages: {} as Record<string, ChatMessage[]>,
    onlineUsers: {} as Record<string, string[]>,
    typingPeerId: '' as string,
    connected: false,
    totalOnline: 0,
    isAiGenerating: false,
  }),

  getters: {
    currentMessages(state): ChatMessage[] {
      return state.messages[state.currentRoomId] || []
    },
    currentOnlineUsers(state): string[] {
      return state.onlineUsers[state.currentRoomId] || []
    },
  },

  actions: {
    handleMessage(msg: ServerMessage) {
      switch (msg.type) {
        case 'welcome':
          this.peerId = msg.peerId
          break

        case 'chat': {
          const roomId = this.currentRoomId
          if (!this.messages[roomId]) {
            this.messages[roomId] = []
          }
          this.messages[roomId].push(msg.message)
          break
        }

        case 'typing':
          if (msg.peerId !== this.peerId) {
            this.typingPeerId = msg.peerId
            setTimeout(() => {
              if (this.typingPeerId === msg.peerId) {
                this.typingPeerId = ''
              }
            }, 3000)
          }
          break

        case 'user-joined':
          this.onlineUsers[this.currentRoomId] = msg.onlineUsers
          break

        case 'user-left':
          this.onlineUsers[this.currentRoomId] = msg.onlineUsers
          break

        case 'history':
          this.messages[this.currentRoomId] = msg.messages
          break

        case 'room-created':
          if (!this.rooms.find((r) => r.id === msg.room.id)) {
            this.rooms.push(msg.room)
          }
          break

        case 'rooms':
          this.rooms = msg.rooms
          break

        case 'online-count':
          this.totalOnline = msg.count
          break

        case 'room-left':
          if (msg.peerId === this.peerId) {
            useToast().add({
              title: `你已经退出 ${msg.roomId} 房间`,
              color: 'neutral',
              icon: 'i-lucide-log-out',
            })
          }
          break

        case 'ai-start': {
          this.isAiGenerating = true
          const roomMsgs = this.messages[msg.roomId]
          if (roomMsgs) {
            roomMsgs.push({
              id: msg.id,
              content: '',
              peerId: msg.peerId,
              timestamp: msg.timestamp,
            })
          }
          break
        }

        case 'ai-chunk': {
          const msgs = this.messages[msg.roomId]
          if (msgs) {
            const target = msgs.find((m) => m.id === msg.id)
            if (target) {
              target.content += msg.text
            }
          }
          break
        }

        case 'ai-end': {
          this.isAiGenerating = false
          break
        }

        case 'ai-stop': {
          this.isAiGenerating = false
          const roomMessages = this.messages[msg.roomId]
          if (roomMessages) {
            const idx = roomMessages.findIndex((m) => m.id === msg.id)
            if (idx !== -1) {
              roomMessages.splice(idx, 1)
            }
          }
          break
        }
      }
    },
  },
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:nuxt -- test/nuxt/chat-store-ai.test.ts`
Expected: PASS — all 5 tests pass

- [ ] **Step 5: Run full test suite**

Run: `bun run test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/stores/chat.ts test/nuxt/chat-store-ai.test.ts
git commit -m "feat(store): add AI streaming message handlers with tests"
```

---

### Task 4: Add stopAi to useChat Composable

**Files:**

- Modify: `app/composables/useChat.ts`

- [ ] **Step 1: Add `stopAi` method to the returned object**

In `app/composables/useChat.ts`, add the `stopAi` function and include it in the return:

```ts
// Add this function inside the useChat() function body, after sendTyping():

function stopAi() {
  send({ type: 'stop-ai' })
}
```

Then add `stopAi` to the return statement:

```ts
return {
  joinRoom,
  sendMessage,
  sendTyping,
  requestHistory,
  createRoom,
  disconnect,
  stopAi,
}
```

The full file should be:

```ts
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

  function stopAi() {
    send({ type: 'stop-ai' })
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
    stopAi,
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/composables/useChat.ts
git commit -m "feat(chat): add stopAi method to useChat composable"
```

---

### Task 5: Server WebSocket AI Streaming Logic

**Files:**

- Modify: `server/routes/_ws.ts`

This is the core task. The `_ws.ts` handler needs to:

1. Track active AI streams per room
2. On `chat` in the `deepseek` room: fetch history, build context, call `streamText`, broadcast chunks
3. On `stop-ai`: abort the stream, broadcast `ai-stop`

- [ ] **Step 1: Add imports and activeAiStreams state at the top of `_ws.ts`**

Add these imports after the existing code at the top of the file (before `export default defineWebSocketHandler`):

```ts
import { streamText } from 'ai'
import { getDeepSeekProvider } from '../utils/ai'
import { getMessages, addMessage } from '../utils/storage'

const activeAiStreams = new Map<string, AbortController>()
const activeAiMsgIds = new Map<string, string>()

const AI_PEER_ID = 'ai:deepseek'
const AI_ROOM_ID = 'deepseek'
const AI_CONTEXT_LIMIT = 20
```

- [ ] **Step 2: Add `handleAiChat` helper function**

Add this function between `broadcastGlobal` and `export default defineWebSocketHandler`:

```ts
async function handleAiChat(roomId: string) {
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
    const contextMessages = history.map((msg) => ({
      role: (msg.peerId === AI_PEER_ID ? 'assistant' : 'user') as 'assistant' | 'user',
      content: msg.content,
    }))

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
      await addMessage(roomId, fullContent, AI_PEER_ID)
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
```

- [ ] **Step 3: Add `stop-ai` case and trigger AI in `chat` case**

Replace the `case 'chat'` block in the `message` handler and add a new `case 'stop-ai'`:

```ts
      case 'chat': {
        const roomId = peerRooms.get(peer.id)
        if (!roomId || !data.content) return
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
```

- [ ] **Step 5: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 6: Run tests**

Run: `bun run test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/routes/_ws.ts
git commit -m "feat(ws): add AI streaming logic for DeepSeek room"
```

---

### Task 6: Auto-Create DeepSeek Room in Seed Plugin

**Files:**

- Modify: `server/plugins/seed.ts`

- [ ] **Step 1: Add 'DeepSeek' room to seed**

```ts
// server/plugins/seed.ts — full replacement
export default defineNitroPlugin(async () => {
  const rooms = await getRooms()
  if (rooms.length === 0) {
    await createRoom('General')
    await createRoom('Random')
    await createRoom('DeepSeek')
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add server/plugins/seed.ts
git commit -m "feat(seed): auto-create DeepSeek room on first launch"
```

---

### Task 7: Update MessageBubble for AI Messages

**Files:**

- Modify: `app/components/chat/MessageBubble.vue`

- [ ] **Step 1: Update MessageBubble to distinguish AI messages**

```vue
<script setup lang="ts">
import type { ChatMessage } from '~/types/chat'
import userIcon from '~/assets/images/user-icon/common.png'

const props = defineProps<{
  message: ChatMessage
  isOwn: boolean
}>()

const isAi = computed(() => props.message.peerId === 'ai:deepseek')
const shortId = computed(() => props.message.peerId.slice(0, 8))
const time = computed(() => new Date(props.message.timestamp).toLocaleTimeString())
</script>

<template>
  <div class="flex gap-2" :class="isOwn ? 'flex-row-reverse' : 'flex-row'">
    <div
      class="max-w-[75%] rounded-lg px-3 py-2"
      :class="
        isOwn
          ? 'bg-green-600 text-white'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
      "
    >
      <div class="text-xs opacity-70 mb-1">
        <template v-if="isAi">
          <span class="inline-flex items-center gap-1">
            <UIcon name="i-lucide-bot" class="size-3" />
            DeepSeek
          </span>
        </template>
        <template v-else> User {{ shortId }} </template>
        <span class="ml-2">{{ time }}</span>
      </div>
      <div class="break-words">
        {{ message.content
        }}<span
          v-if="isAi && !message.content"
          class="inline-block w-2 h-4 ml-0.5 bg-current animate-pulse"
        />
      </div>
    </div>
  </div>
</template>
```

Key changes:

- `isAi` computed detects AI messages by `peerId === 'ai:deepseek'`
- AI messages show a bot icon + "DeepSeek" label instead of "User xxx"
- Empty AI messages (during streaming start) show a blinking cursor

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/components/chat/MessageBubble.vue
git commit -m "feat(ui): add AI message visual distinction in MessageBubble"
```

---

### Task 8: Update MessageInput for AI Stop Button

**Files:**

- Modify: `app/components/chat/MessageInput.vue`

- [ ] **Step 1: Update MessageInput with stop button and disabled state**

```vue
<script setup lang="ts">
import userIcon from '~/assets/images/user-icon/common.png'

const emit = defineEmits<{
  send: [content: string]
  typing: []
  stop: []
}>()

const store = useChatStore()
const input = ref('')
let typingTimer: ReturnType<typeof setTimeout> | null = null

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    sendMessage()
  }
}

function sendMessage() {
  const content = input.value.trim()
  if (!content || store.isAiGenerating) return
  emit('send', content)
  input.value = ''
}

function handleInput() {
  if (typingTimer) clearTimeout(typingTimer)
  emit('typing')
  typingTimer = setTimeout(() => {
    typingTimer = null
  }, 2000)
}
</script>

<template>
  <div class="flex gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
    <UAvatar class="w-8 h-8" :src="userIcon"></UAvatar>
    <div class="w-1"></div>
    <UInput
      v-model="input"
      :placeholder="store.isAiGenerating ? 'AI is thinking...' : 'Type a message...'"
      :disabled="store.isAiGenerating"
      class="flex-1"
      @keydown="handleKeydown"
      @input="handleInput"
    />
    <UButton v-if="store.isAiGenerating" color="neutral" variant="subtle" @click="emit('stop')">
      <UIcon name="i-lucide-square" class="size-4" />
      Stop
    </UButton>
    <UButton v-else :disabled="!input.trim()" @click="sendMessage"> Send </UButton>
  </div>
</template>
```

Key changes:

- Reads `store.isAiGenerating` to toggle between send/stop states
- Input is disabled during AI generation with placeholder "AI is thinking..."
- Stop button emits `stop` event instead of `send`

- [ ] **Step 2: Wire `@stop` event in `[roomId].vue`**

`MessageList.vue` does not render `MessageInput` — it's used directly in the page. In `app/pages/chat/[roomId].vue`, update the `ChatMessageInput` line to add the `@stop` handler. Also destructure `stopAi` from `useChat()`:

In the `<script setup>` block, change:

```ts
const { joinRoom, sendMessage, sendTyping, createRoom } = useChat()
```

to:

```ts
const { joinRoom, sendMessage, sendTyping, createRoom, stopAi } = useChat()
```

In the `<template>`, change:

```vue
<ChatMessageInput @send="sendMessage" @typing="sendTyping" />
```

to:

```vue
<ChatMessageInput @send="sendMessage" @typing="sendTyping" @stop="stopAi" />
```

- [ ] **Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/components/chat/MessageInput.vue app/pages/chat/[roomId].vue
git commit -m "feat(ui): add stop button and disable input during AI generation"
```

---

### Task 9: Integration Verification

- [ ] **Step 1: Run full test suite**

Run: `bun run test`
Expected: PASS

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: Manual verification checklist**

Start the dev server (`bun run dev`) and verify:

1. Navigate to `/chat/deepseek` — the DeepSeek room should appear in the sidebar
2. Send a message — AI response should stream in with the bot icon label
3. Send another message while AI is responding — the old stream should stop, new one starts
4. Click "Stop" button during generation — incomplete AI message should disappear, input re-enabled
5. Navigate away and back — previous AI messages should still be visible (persisted in DB)
6. Regular rooms (General, Random) should work exactly as before — no AI interference
