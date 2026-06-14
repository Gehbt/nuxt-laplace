import { openDB } from 'idb'

import type { ChatMessage } from '../types/chat'

const DB_NAME = 'laplace-chat'
const DB_VERSION = 2
const STORE_NAME = 'messages'
const MAX_MESSAGES_PER_ROOM = 200

interface CachedMessage extends ChatMessage {
  roomId: string
}

function getDb() {
  return openDB<CachedMessage>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('roomId', 'roomId', { unique: false })
        store.createIndex('roomId_timestamp', ['roomId', 'timestamp'], {
          unique: false,
        })
      }
      // v1 → v2: content changed from string to MessagePart[]. IndexedDB is
      // schemaless, but cached v1 messages have string content that won't render.
      // Recreate the store to drop stale rows.
      if (oldVersion === 1) {
        db.deleteObjectStore(STORE_NAME)
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('roomId', 'roomId', { unique: false })
        store.createIndex('roomId_timestamp', ['roomId', 'timestamp'], {
          unique: false,
        })
      }
    },
  })
}

export async function getCachedMessages(roomId: string): Promise<ChatMessage[]> {
  if (!import.meta.client) return []
  const db = await getDb()
  const range = IDBKeyRange.bound(
    [roomId, Number.NEGATIVE_INFINITY],
    [roomId, Number.POSITIVE_INFINITY],
  )
  const all: CachedMessage[] = await db.getAllFromIndex(STORE_NAME, 'roomId_timestamp', range)
  // Take last 200 (index is ascending, so slice from end)
  const recent = all.slice(-MAX_MESSAGES_PER_ROOM)
  return recent.map(({ roomId: _, ...msg }) => msg)
}

export async function putCachedMessages(roomId: string, messages: ChatMessage[]): Promise<void> {
  if (!import.meta.client || messages.length === 0) return
  const db = await getDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  // Write all messages
  for (const msg of messages) {
    await store.put({ ...msg, roomId })
  }

  // Trim to MAX_MESSAGES_PER_ROOM — delete oldest beyond limit
  const range = IDBKeyRange.bound(
    [roomId, Number.NEGATIVE_INFINITY],
    [roomId, Number.POSITIVE_INFINITY],
  )
  let cursor = await store.index('roomId_timestamp').openCursor(range)
  const total = await store.index('roomId').count(range)
  const excess = total - MAX_MESSAGES_PER_ROOM
  let deleted = 0
  while (cursor && deleted < excess) {
    await cursor.delete()
    deleted++
    cursor = await cursor.continue()
  }

  await tx.done
}

export async function appendCachedMessage(roomId: string, message: ChatMessage): Promise<void> {
  if (!import.meta.client) return
  await putCachedMessages(roomId, [message])
}

export async function clearCachedRoom(roomId: string): Promise<void> {
  if (!import.meta.client) return
  const db = await getDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const index = tx.objectStore(STORE_NAME).index('roomId')
  let cursor = await index.openCursor(IDBKeyRange.only(roomId))
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}
