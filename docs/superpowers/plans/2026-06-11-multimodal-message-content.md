# Multimodal Message Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the chat message system from plain-text `content: string` to structured `content: MessagePart[]` (text + image parts), enabling image display in chat and image understanding by AI.

**Architecture:** The `content` column in the database changes from `text` to `jsonb`, storing an array of `{ type: 'text', text } | { type: 'image', url }` parts. Every layer — DB schema → repositories → storage utils → WebSocket protocol → Pinia store → components → AI context builder — is updated to work with this structured content type. A one-time migration converts existing text rows to `[{ type: 'text', text: '...' }]`.

**Tech Stack:** Nuxt 4, Drizzle ORM (jsonb column), Vercel AI SDK (multimodal `UserContent`), crossws WebSocket, Pinia, IndexedDB (idb)

---

## File Structure

| File                                           | Action | Responsibility                                                                                                                           |
| ---------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `app/types/chat.ts`                            | Modify | Define `MessagePart` union type; change `ChatMessage.content` from `string` to `MessagePart[]`; update `ClientMessage` / `ServerMessage` |
| `server/database/schema.ts`                    | Modify | Change `messages.content` column from `text` to `jsonb`                                                                                  |
| `server/repositories/message.repository.ts`    | Modify | `create` accepts `MessagePart[]`; `findByRoom` returns typed rows                                                                        |
| `server/utils/storage.ts`                      | Modify | `addMessage` accepts `MessagePart[]` instead of `string`                                                                                 |
| `server/routes/_ws.ts`                         | Modify | AI context builder converts `MessagePart[]` to AI SDK multimodal format; `chat` handler passes structured content                        |
| `server/api/rooms/[roomId]/messages.get.ts`    | Modify | Return type alignment (no logic change)                                                                                                  |
| `app/stores/chat.ts`                           | Modify | `ai-chunk` accumulates into a text part instead of raw string; `chat` handler stores `MessagePart[]`                                     |
| `app/composables/useChat.ts`                   | Modify | `sendMessage` sends `MessagePart[]`; `chat` ClientMessage uses structured content                                                        |
| `app/composables/useChatCache.ts`              | Modify | IndexedDB schema version bump (v2) to handle `MessagePart[]`                                                                             |
| `app/components/chat/MessageBubble.vue`        | Modify | Render parts array: text parts as text, image parts as `<img>`                                                                           |
| `app/components/chat/MessageInput.vue`         | Modify | Emit `MessagePart[]` instead of `string`; add image upload button (wired to upload API)                                                  |
| `app/pages/chat/[roomId].vue`                  | Modify | `aiMessagesAsChat` mapping adapts to parts; AI chat sends image parts                                                                    |
| `server/api/upload.ts`                         | Create | `POST` endpoint accepting `multipart/form-data`, returning `{ url: string }`                                                             |
| `server/utils/storage-upload.ts`               | Create | File storage utility (save to disk, return public URL)                                                                                   |
| `migrations/XXXX_convert_content_to_jsonb.sql` | Create | Migration: `text` → `jsonb` with data conversion                                                                                         |
| `test/unit/storage.test.ts`                    | Modify | Adapt all `addMessage` calls to use `MessagePart[]` format; add tests for structured content                                             |
| `test/unit/message-parts.test.ts`              | Create | Unit tests for `MessagePart` helpers and edge cases                                                                                      |
| `test/nuxt/chat-store-ai.test.ts`              | Modify | Adapt AI lifecycle tests to use `MessagePart[]` content                                                                                  |

---

## Task 1: Define `MessagePart` types and update `ChatMessage`

**Files:**

- Modify: `app/types/chat.ts`

- [ ] **Step 1: Write the type definitions**

```ts
// app/types/chat.ts

export interface TextPart {
  type: 'text'
  text: string
}

export interface ImagePart {
  type: 'image'
  url: string
}

export type MessagePart = TextPart | ImagePart
```

- [ ] **Step 2: Update `ChatMessage.content` from `string` to `MessagePart[]`**

```ts
export interface ChatMessage {
  id: string
  content: MessagePart[]
  peerId: string
  timestamp: number
}
```

- [ ] **Step 3: Update `ClientMessage` chat variant**

Change the `content` field from `string` to `MessagePart[]`:

```ts
export type ClientMessage =
  | { type: 'join'; roomId: string }
  | { type: 'chat'; content: MessagePart[]; llmOptions?: Record<string, unknown> }
  | { type: 'typing' }
  | { type: 'history'; roomId: string; before?: number; limit?: number }
  | { type: 'create-room'; name: string }
  | { type: 'stop-ai' }
```

- [ ] **Step 4: Add `ai-image-chunk` to `ServerMessage`**

AI responses may include images in the future. For now, add the type for forward compatibility — but do NOT implement image generation. The `ai-chunk` stays text-only for this plan:

```ts
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

- [ ] **Step 5: Commit**

```bash
git add app/types/chat.ts
git commit -m "feat: define MessagePart types and update ChatMessage to structured content"
```

---

## Task 2: Database schema — `content` from `text` to `jsonb`

**Files:**

- Modify: `server/database/schema.ts`

- [ ] **Step 1: Update the schema column type**

```ts
// server/database/schema.ts

import { relations } from 'drizzle-orm'
import { bigint, index, jsonb, pgSchema, uuid, varchar } from 'drizzle-orm/pg-core'

const chatSchema = pgSchema('chat')

export const rooms = chatSchema.table('rooms', {
  id: varchar('id').primaryKey(),
  name: varchar('name').notNull(),
})

export const roomsRelations = relations(rooms, ({ many }) => ({
  messages: many(messages),
}))

export const messages = chatSchema.table(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    content: jsonb('content').notNull(),
    peerId: varchar('peer_id').notNull(),
    timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
    roomId: varchar('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
  },
  (table) => [index('messages_room_timestamp_idx').on(table.roomId, table.timestamp)],
)

export const messagesRelations = relations(messages, ({ one }) => ({
  room: one(rooms, {
    fields: [messages.roomId],
    references: [rooms.id],
  }),
}))
```

- [ ] **Step 2: Generate the migration**

Run: `bun run db:generate`

The generated migration SQL should contain the column type change. Verify it looks roughly like:

```sql
ALTER TABLE "chat"."messages" ALTER COLUMN "content" SET DATA TYPE jsonb USING (
  jsonb_build_array(jsonb_build_object('type', 'text', 'text', "content"))
);
```

If Drizzle generates only a simple `ALTER COLUMN ... SET DATA TYPE jsonb` without the `USING` clause that wraps existing text into `[{ type: 'text', text: '...' }]`, manually edit the generated migration SQL to include the `USING` clause above. This is critical — without it, existing text rows will fail to cast to jsonb.

- [ ] **Step 3: Run the migration**

Run: `bun run db:migrate`

- [ ] **Step 4: Verify migration manually**

Run against the database:

```bash
psql "$NUXT_DATABASE_URL" -c "SELECT id, content FROM chat.messages LIMIT 5;"
```

Expected: each `content` row should show `[{"type": "text", "text": "..."}]` instead of bare text strings.

- [ ] **Step 5: Commit**

```bash
git add server/database/schema.ts migrations/
git commit -m "feat: change messages.content from text to jsonb with data migration"
```

---

## Task 3: Repository and storage layer

**Files:**

- Modify: `server/repositories/message.repository.ts`
- Modify: `server/utils/storage.ts`

- [ ] **Step 1: Update `MessageRepository.create` to accept `MessagePart[]`**

```ts
// server/repositories/message.repository.ts

import type { MessagePart } from '../../app/types/chat'

import type { ChatMessage } from '../../app/types/chat'

import { and, asc, eq, lt } from 'drizzle-orm'

import { db } from '../database/client'
import { messages } from '../database/schema'

export class MessageRepository {
  async findByRoom(roomId: string, before?: number, limit = 50): Promise<ChatMessage[]> {
    const conditions = [eq(messages.roomId, roomId)]
    if (before) {
      conditions.push(lt(messages.timestamp, before))
    }

    return db
      .select()
      .from(messages)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(asc(messages.timestamp))
      .limit(limit)
  }

  async create(roomId: string, content: MessagePart[], peerId: string): Promise<ChatMessage> {
    const [message] = await db
      .insert(messages)
      .values({ roomId, content, peerId, timestamp: Date.now() })
      .returning()
    return message!
  }
}
```

- [ ] **Step 2: Update `storage.ts` — `addMessage` accepts `MessagePart[]`**

```ts
// server/utils/storage.ts

import type { MessagePart } from '../../app/types/chat'

import type { ChatMessage, Room } from '../../app/types/chat'

import { MessageRepository } from '../repositories/message.repository'
import { RoomRepository } from '../repositories/room.repository'

const roomRepo = new RoomRepository()
const messageRepo = new MessageRepository()

export async function getRooms(): Promise<Room[]> {
  return roomRepo.findAll()
}

export async function createRoom(name: string): Promise<Room> {
  return roomRepo.create(name)
}

export async function getMessages(
  roomId: string,
  before?: number,
  limit?: number,
): Promise<ChatMessage[]> {
  return messageRepo.findByRoom(roomId, before, limit)
}

export async function addMessage(
  roomId: string,
  content: MessagePart[],
  peerId: string,
): Promise<ChatMessage> {
  return messageRepo.create(roomId, content, peerId)
}
```

- [ ] **Step 3: Commit**

```bash
git add server/repositories/message.repository.ts server/utils/storage.ts
git commit -m "feat: update repository and storage layer for MessagePart[] content"
```

---

## Task 4: WebSocket handler — structured content and multimodal AI context

**Files:**

- Modify: `server/routes/_ws.ts`

- [ ] **Step 1: Update the `chat` case to pass `MessagePart[]`**

In the `message` handler's `chat` case, the incoming `data.content` is now `MessagePart[]`. Replace the relevant section:

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
```

Also update the `data` type annotation to use `MessagePart[]`:

```ts
let data: {
  type: string
  roomId?: string
  content?: MessagePart[]
  name?: string
  before?: number
  limit?: number
}
```

Add the import at the top of the file:

```ts
import type { MessagePart } from '../../app/types/chat'
```

- [ ] **Step 2: Update AI context builder for multimodal messages**

Replace the `handleAiChat` context building section. Currently it maps `content` (string) directly. Now `content` is `MessagePart[]`, and we must convert it to the AI SDK's `UserContent` format:

```ts
import type { MessagePart } from '../../app/types/chat'

// Inside handleAiChat:
const history = await getMessages(roomId, undefined, AI_CONTEXT_LIMIT)
const contextMessages = history.map((msg) => {
  const role = msg.peerId === AI_PEER_ID ? 'assistant' : ('user' as const)

  if (role === 'assistant') {
    // AI messages are always text-only (from ai-chunk accumulation)
    const text = msg.content
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('')
    return { role: 'assistant' as const, content: text }
  }

  // User messages: convert MessagePart[] to AI SDK content parts
  const parts = msg.content.map((part): Record<string, unknown> => {
    if (part.type === 'text') {
      return { type: 'text' as const, text: part.text }
    }
    if (part.type === 'image') {
      return { type: 'image' as const, image: part.url }
    }
    return { type: 'text' as const, text: '' }
  })

  // If only one text part, send as plain string (simpler for the model)
  if (parts.length === 1 && parts[0].type === 'text') {
    return { role: 'user' as const, content: (parts[0] as { text: string }).text }
  }

  return { role: 'user' as const, content: parts }
})
```

- [ ] **Step 3: Update AI message storage — store as `MessagePart[]`**

When the AI stream completes, store the full text as a `MessagePart[]`:

```ts
// Replace the existing line:
//   await addMessage(roomId, fullContent, AI_PEER_ID)
// With:
await addMessage(roomId, [{ type: 'text', text: fullContent }], AI_PEER_ID)
```

- [ ] **Step 4: Commit**

```bash
git add server/routes/_ws.ts
git commit -m "feat: WebSocket handler supports MessagePart[] and multimodal AI context"
```

---

## Task 5: Pinia store — structured content handling

**Files:**

- Modify: `app/stores/chat.ts`

- [ ] **Step 1: Update `ai-chunk` handler — accumulate into a text part**

The AI message starts with empty `content: []` (from `ai-start`). Each `ai-chunk` appends text to the first text part (or creates one if missing):

```ts
case 'ai-start': {
  this.isAiGenerating = true
  const roomMsgs = this.messages[msg.roomId] || []
  this.messages[msg.roomId] = roomMsgs
  roomMsgs.push({
    id: msg.id,
    content: [],  // Start with empty parts array
    peerId: msg.peerId,
    timestamp: msg.timestamp,
  })
  break
}

case 'ai-chunk': {
  const chunkMessages = this.messages[msg.roomId]
  if (chunkMessages) {
    const target = chunkMessages.find((m) => m.id === msg.id)
    if (target) {
      // Find or create the text part
      const textPart = target.content.find((p) => p.type === 'text')
      if (textPart && textPart.type === 'text') {
        textPart.text += msg.text
      } else {
        target.content.push({ type: 'text', text: msg.text })
      }
    }
  }
  break
}
```

- [ ] **Step 2: Commit**

```bash
git add app/stores/chat.ts
git commit -m "feat: Pinia store handles MessagePart[] content for AI messages"
```

---

## Task 6: WebSocket client composable

**Files:**

- Modify: `app/composables/useChat.ts`

- [ ] **Step 1: Update `sendMessage` to accept `MessagePart[]`**

```ts
function sendMessage(content: MessagePart[]) {
  send({ type: 'chat', content })
}
```

Add the import:

```ts
import type { ClientMessage, MessagePart } from '~/types/chat'
```

- [ ] **Step 2: Commit**

```bash
git add app/composables/useChat.ts
git commit -m "feat: useChat sendMessage accepts MessagePart[] content"
```

---

## Task 7: IndexedDB cache — handle `MessagePart[]` content

**Files:**

- Modify: `app/composables/useChatCache.ts`

- [ ] **Step 1: Bump DB version to 2**

The cache already stores `ChatMessage` objects via `idb`. Since the `content` field type changed from `string` to `MessagePart[]`, existing cached data with `content: "some text"` will be stale.

Bump the version and add an upgrade path:

```ts
const DB_VERSION = 2
```

Update the `upgrade` callback to handle both v1→v2 and fresh installs:

```ts
function getDb() {
  return openDB<CachedMessage>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        // Fresh install — create store from scratch
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('roomId', 'roomId', { unique: false })
          store.createIndex('roomId_timestamp', ['roomId', 'timestamp'], {
            unique: false,
          })
        }
      }
      // v1 → v2: content field changed from string to MessagePart[]
      // No structural schema change needed (IndexedDB is schemaless).
      // Stale v1 entries will be replaced as new messages arrive.
      // If we wanted to migrate existing cached messages:
      // We could iterate and convert, but it's simpler to let the cache
      // naturally refresh. Old cache entries with content as string will
      // cause render issues, so we clear the cache on upgrade.
      if (oldVersion === 1) {
        // The store already exists. We'll clear stale data in onMounted.
        // No structural change needed — just bumping version triggers the upgrade.
      }
    },
  })
}
```

- [ ] **Step 2: Add a cache-clear function for the version bump**

Since v1 cache entries have `content: string` and v2 expects `content: MessagePart[]`, add a utility to clear stale data:

```ts
export async function clearAllCaches(): Promise<void> {
  if (!import.meta.client) return
  const database = await getDb()
  const tx = database.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  await store.clear()
  await tx.done
}
```

This will be called once on app load when the DB version changes (in Task 9).

- [ ] **Step 3: Commit**

```bash
git add app/composables/useChatCache.ts
git commit -m "feat: bump IndexedDB cache version for MessagePart[] content"
```

---

## Task 8: Upload API and storage utility

**Files:**

- Create: `server/utils/storage-upload.ts`
- Create: `server/api/upload.ts`

- [ ] **Step 1: Create file storage utility**

```ts
// server/utils/storage-upload.ts

import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const UPLOAD_DIR = 'uploads'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export async function saveUploadedFile(file: {
  data: ArrayBuffer
  type: string
  name: string
}): Promise<{ url: string; filename: string }> {
  if (file.data.byteLength > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${file.data.byteLength} bytes (max ${MAX_FILE_SIZE})`)
  }

  const ext = file.name.split('.').pop() || 'bin'
  const filename = `${randomUUID()}.${ext}`
  const filePath = join(UPLOAD_DIR, filename)

  await mkdir(UPLOAD_DIR, { recursive: true })
  await writeFile(filePath, Buffer.from(file.data))

  // URL relative to the server root — served by Nitro's public dir or a static route
  const url = `/uploads/${filename}`
  return { url, filename }
}
```

- [ ] **Step 2: Create upload API endpoint**

```ts
// server/api/upload.ts

import { saveUploadedFile } from '../utils/storage-upload'

export default defineEventHandler(async (event) => {
  const formData = await readFormData(event)
  const file = formData.get('file')

  if (!file || !(file instanceof File)) {
    throw createError({ statusCode: 400, message: 'No file provided' })
  }

  // Validate mime type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    throw createError({
      statusCode: 400,
      message: `Invalid file type: ${file.type}. Allowed: ${allowedTypes.join(', ')}`,
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
```

- [ ] **Step 3: Serve uploaded files statically**

In `nuxt.config.ts`, add a Nitro route rule to serve the `uploads/` directory:

```ts
// nuxt.config.ts — add to the nitro config
nitro: {
  experimental: { websocket: true },
  publicAssets: [
    { dir: '../uploads', baseURL: '/uploads', maxAge: 60 * 60 * 24 * 365 },
  ],
},
```

- [ ] **Step 4: Commit**

```bash
git add server/utils/storage-upload.ts server/api/upload.ts nuxt.config.ts
git commit -m "feat: add image upload API and file storage utility"
```

---

## Task 9: Chat components — render and send structured content

**Files:**

- Modify: `app/components/chat/MessageBubble.vue`
- Modify: `app/components/chat/MessageInput.vue`
- Modify: `app/pages/chat/[roomId].vue`

- [ ] **Step 1: Update `MessageBubble.vue` to render `MessagePart[]`**

```vue
<script setup lang="ts">
import type { ChatMessage } from '~/types/chat'

const props = defineProps<{
  message: ChatMessage
  isOwn: boolean
}>()

const isAi = computed(() => props.message.peerId === 'ai:deepseek')
const shortId = computed(() => props.message.peerId.slice(0, 8))
const time = computed(() => new Date(props.message.timestamp).toLocaleTimeString())

const hasContent = computed(() =>
  props.message.content.some((p) => {
    if (p.type === 'text') return p.text.length > 0
    return true
  }),
)
</script>

<template>
  <div class="flex gap-2" :class="isOwn ? 'flex-row-reverse' : 'flex-row'">
    <div
      class="max-w-[75%] rounded-lg px-3 py-2"
      :class="isOwn ? 'bg-green-500 text-white' : 'bg-elevated text-default'"
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
      <div class="space-y-1">
        <template v-for="(part, i) in message.content" :key="i">
          <div v-if="part.type === 'text'" class="wrap-break-word">
            {{ part.text }}
          </div>
          <div v-else-if="part.type === 'image'" class="mt-1">
            <img
              :src="part.url"
              alt="Shared image"
              class="max-w-full max-h-80 rounded-md cursor-pointer"
              loading="lazy"
              @click="(e: MouseEvent) => (e.currentTarget as HTMLImageElement).requestFullscreen()"
            />
          </div>
        </template>
        <!-- Streaming cursor for AI messages with no text yet -->
        <span
          v-if="isAi && !hasContent"
          class="inline-block w-2 h-4 ml-0.5 bg-current animate-pulse"
        />
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Update `MessageInput.vue` to emit `MessagePart[]` and support image upload**

```vue
<script setup lang="ts">
import type { MessagePart } from '~/types/chat'

import { useChatStore } from '@/stores/chat'
import userIcon from '~/assets/images/user-icon/common.png'

const emit = defineEmits<{
  send: [content: MessagePart[]]
  typing: []
  stop: []
}>()

const store = useChatStore()
const input = ref('')
const pendingImages = ref<{ url: string; file: File }[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
let typingTimer: ReturnType<typeof setTimeout> | null = null

async function uploadImage(file: File): Promise<string | null> {
  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await $fetch<{ url: string }>('/api/upload', {
      method: 'POST',
      body: formData,
    })
    return res.url
  } catch {
    return null
  }
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files) return
  for (const file of Array.from(target.files)) {
    if (!file.type.startsWith('image/')) continue
    const previewUrl = URL.createObjectURL(file)
    pendingImages.value.push({ url: previewUrl, file })
  }
  // Reset input so the same file can be re-selected
  target.value = ''
}

function removePendingImage(index: number) {
  const removed = pendingImages.value.splice(index, 1)[0]
  if (removed) URL.revokeObjectURL(removed.url)
}

async function sendMessage() {
  const text = input.value.trim()
  const hasImages = pendingImages.value.length > 0
  if ((!text && !hasImages) || store.isAiGenerating) return

  const parts: MessagePart[] = []
  if (text) {
    parts.push({ type: 'text', text })
  }

  // Upload images and add image parts
  for (const pending of pendingImages.value) {
    const url = await uploadImage(pending.file)
    if (url) {
      parts.push({ type: 'image', url })
    }
    URL.revokeObjectURL(pending.url)
  }

  if (parts.length === 0) return

  emit('send', parts)
  input.value = ''
  pendingImages.value = []
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    sendMessage()
  }
}

function handleInput() {
  if (typingTimer) clearTimeout(typingTimer)
  emit('typing')
  typingTimer = setTimeout(() => {
    typingTimer = null
  }, 2000)
}

function triggerFileSelect() {
  fileInput.value?.click()
}
</script>

<template>
  <div class="p-4 border-t border-default">
    <!-- Pending image previews -->
    <div v-if="pendingImages.length > 0" class="flex gap-2 mb-2 flex-wrap">
      <div v-for="(img, i) in pendingImages" :key="img.url" class="relative group">
        <img
          :src="img.url"
          alt="Pending upload"
          class="w-20 h-20 object-cover rounded-lg border border-default"
        />
        <button
          class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          @click="removePendingImage(i)"
        >
          x
        </button>
      </div>
    </div>

    <div class="flex gap-2">
      <UAvatar class="w-8 h-8" :src="userIcon" />
      <div class="w-1" />
      <UInput
        v-model="input"
        :placeholder="store.isAiGenerating ? 'AI is thinking...' : 'Type a message...'"
        :disabled="store.isAiGenerating"
        class="flex-1"
        @keydown="handleKeydown"
        @input="handleInput"
      />
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        @change="handleFileSelect"
      />
      <UButton
        color="neutral"
        variant="ghost"
        :disabled="store.isAiGenerating"
        @click="triggerFileSelect"
      >
        <UIcon name="i-lucide-image-plus" class="size-4" />
      </UButton>
      <UButton v-if="store.isAiGenerating" color="neutral" variant="subtle" @click="emit('stop')">
        <UIcon name="i-lucide-square" class="size-4" />
        Stop
      </UButton>
      <UButton v-else :disabled="!input.trim() && pendingImages.length === 0" @click="sendMessage">
        Send
      </UButton>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Update `[roomId].vue` — adapt `sendMessage` call and AI message mapping**

The regular-room `sendMessage` call in the template already calls the composable's `sendMessage`, which now expects `MessagePart[]`. The `MessageInput` emits `MessagePart[]`, so the `@send` handler passes it through:

```vue
<!-- In the Regular Room Chat template section, change: -->
<!--   <ChatMessageInput @send="sendMessage" @typing="sendTyping" @stop="stopAi" /> -->
<!-- To: -->
<ChatMessageInput @send="(parts) => sendMessage(parts)" @typing="sendTyping" @stop="stopAi" />
```

For the DeepSeek AI room, update the `aiMessagesAsChat` computed to handle `parts` from `UIMessage`:

```ts
const aiMessagesAsChat = computed<ChatMessage[]>(() => {
  const chat = aiChat.value
  if (!chat) return []
  return chat.messages.map((m) => ({
    id: m.id,
    content: (m.parts || [])
      .map((p) => {
        if (p.type === 'text') {
          return { type: 'text' as const, text: p.text }
        }
        if (p.type === 'file') {
          return { type: 'image' as const, url: p.url }
        }
        return { type: 'text' as const, text: '' }
      })
      .filter((p) => !(p.type === 'text' && p.text === '')),
    peerId: m.role === 'user' ? store.peerId.slice(0, 8) : 'ai:deepseek',
    timestamp: Date.now(),
  }))
})
```

- [ ] **Step 4: Commit**

```bash
git add app/components/chat/MessageBubble.vue app/components/chat/MessageInput.vue app/pages/chat/[roomId].vue
git commit -m "feat: chat components render and send MessagePart[] content"
```

---

## Task 10: Update tests for structured content

**Files:**

- Modify: `test/unit/storage.test.ts`
- Modify: `test/nuxt/chat-store-ai.test.ts`
- Create: `test/unit/message-parts.test.ts`

- [ ] **Step 1: Update `test/unit/storage.test.ts`**

Every `addMessage` call now takes `MessagePart[]` instead of `string`. Replace all occurrences:

```ts
// Before:
await addMessage(roomId, 'Hello!', 'peer-1')

// After:
await addMessage(roomId, [{ type: 'text', text: 'Hello!' }], 'peer-1')
```

Update all assertions that check `msg.content` as a string:

```ts
// Before:
expect(msg).toMatchObject({
  content: 'Hello!',
  peerId: 'peer-1',
})

// After:
expect(msg).toMatchObject({
  content: [{ type: 'text', text: 'Hello!' }],
  peerId: 'peer-1',
})
```

And all assertions that access `.content` directly:

```ts
// Before:
expect(result[0].content).toBe('First')

// After:
expect(result[0].content).toEqual([{ type: 'text', text: 'First' }])
```

Apply this pattern to every test in the file.

- [ ] **Step 2: Run unit tests to verify**

Run: `bun run test:unit`

Expected: All tests pass with the new `MessagePart[]` format.

- [ ] **Step 3: Update `test/nuxt/chat-store-ai.test.ts`**

AI messages now use `content: MessagePart[]`. Update `ai-start` and `ai-chunk` assertions:

```ts
// ai-start test — expect empty array instead of empty string
expect(store.currentMessages[0]).toEqual({
  id: 'msg-1',
  content: [],
  peerId: 'ai:deepseek',
  timestamp: 1000,
})

// ai-chunk test — check text accumulation in parts
const msg = store.currentMessages.find((m) => m.id === 'msg-1')!
const textPart = msg.content.find((p) => p.type === 'text')
expect(textPart).toBeDefined()
expect((textPart as { type: 'text'; text: string }).text).toBe('Hello world')
```

- [ ] **Step 4: Create `test/unit/message-parts.test.ts` for edge cases**

```ts
import { describe, it, expect } from 'vitest'

describe('MessagePart types', () => {
  it('creates a valid TextPart', () => {
    const part = { type: 'text' as const, text: 'Hello' }
    expect(part.type).toBe('text')
    expect(part.text).toBe('Hello')
  })

  it('creates a valid ImagePart', () => {
    const part = { type: 'image' as const, url: '/uploads/test.png' }
    expect(part.type).toBe('image')
    expect(part.url).toBe('/uploads/test.png')
  })

  it('MessagePart array can mix text and image parts', () => {
    const parts = [
      { type: 'text' as const, text: 'Look at this:' },
      { type: 'image' as const, url: '/uploads/cat.png' },
    ]
    expect(parts).toHaveLength(2)
    expect(parts[0].type).toBe('text')
    expect(parts[1].type).toBe('image')
  })
})
```

- [ ] **Step 5: Run all tests**

Run: `bun run test`

Expected: All unit and Nuxt integration tests pass.

- [ ] **Step 6: Commit**

```bash
git add test/unit/storage.test.ts test/nuxt/chat-store-ai.test.ts test/unit/message-parts.test.ts
git commit -m "test: update tests for MessagePart[] structured content"
```

---

## Task 11: End-to-end verification

- [ ] **Step 1: Run typecheck**

Run: `bun run typecheck`

Expected: No type errors. If there are type errors from files that reference `content: string`, fix them to use `MessagePart[]`.

- [ ] **Step 2: Run linter**

Run: `bun run lint`

Expected: No lint errors.

- [ ] **Step 3: Manual smoke test**

1. Start the dev server: `bun run dev`
2. Open the app in a browser
3. Navigate to a regular room (e.g., `#general`)
4. Send a text message — verify it renders correctly
5. Upload an image via the new image button — verify preview appears, then sends and renders
6. Send a message with both text and an image — verify both parts render
7. Navigate to the DeepSeek AI room
8. Send a text message — verify AI responds
9. Send an image + text message — verify AI can "see" and describe the image
10. Reload the page — verify messages load from cache correctly

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete multimodal message content support"
```
