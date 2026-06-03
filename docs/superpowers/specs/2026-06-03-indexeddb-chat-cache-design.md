# IndexedDB Chat Cache Design

## Goal

Add a client-side IndexedDB cache layer for chat messages, so entering a room shows cached messages instantly before server history arrives via WebSocket.

## Scope

- Regular WebSocket rooms only (not DeepSeek AI room)
- Cache the latest 200 messages per room
- Use `idb` library for IndexedDB operations

## Architecture

```
User enters room → read IndexedDB (instant render)
                        ↓
                 WebSocket 'history' arrives → merge → update IndexedDB + UI
                        ↓
                 new 'chat' messages arrive → append to Pinia + IndexedDB
```

## Components

### 1. `app/composables/useChatCache.ts`

New composable wrapping `idb` operations.

- **DB name:** `laplace-chat`
- **Object store:** `messages` — stores `{ roomId, id, content, peerId, timestamp }`
- **Index:** `roomId` for per-room queries
- **Methods:**
  - `getMessages(roomId: string): Promise<ChatMessage[]>` — returns cached messages sorted by timestamp, capped at 200
  - `putMessages(roomId: string, messages: ChatMessage[]): Promise<void>` — writes messages and trims to 200 newest
  - `clearRoom(roomId: string): Promise<void>` — deletes all cached messages for a room

### 2. Integration with existing code

**`app/stores/chat.ts`:**

- Add a `loadCachedMessages(roomId)` action that reads from IndexedDB and populates `messages[roomId]`
- In `handleMessage` for `history` case: write received messages to IndexedDB after setting in state
- In `handleMessage` for `chat` case: append to IndexedDB after pushing to state

**`app/composables/useChat.ts`:**

- In `joinRoom`: call `store.loadCachedMessages(roomId)` before sending the `join` WebSocket message, so the UI shows cached data immediately

**`app/pages/chat/[roomId].vue`:**

- No changes needed — the Pinia store already drives the template

## Trim Strategy

On every `putMessages` call, within a single IDB transaction:

1. Write incoming messages using `put` (upsert by `id`)
2. Open a cursor on the `roomId` index, sorted by `timestamp` descending
3. Skip the first 200 entries, delete the rest

## Key Decisions

- **`idb` over raw API:** Cleaner async code, ~1.5KB gzip, well-maintained
- **Store-level integration:** Cache logic lives in the Pinia store actions, keeping composables thin
- **No background sync:** Cache is read-only on room enter; all writes happen in response to WebSocket messages
