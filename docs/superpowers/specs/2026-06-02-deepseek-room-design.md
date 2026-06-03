# DeepSeek AI Chat Room Integration Design

Date: 2026-06-02

## Goal

Integrate DeepSeek AI into the existing WebSocket-based chat room system. Add a dedicated "deepseek" room where every user message receives an AI streaming response. The client reuses the existing `[roomId].vue` page and components with minimal changes.

## Architecture: Server-Driven AI via WebSocket (Approach A)

The server detects messages in the DeepSeek room, calls the DeepSeek API via `streamText`, and pushes AI response chunks through the existing WebSocket connection. The client does not need to know about AI-specific HTTP endpoints — it only renders messages.

## WebSocket Protocol Extension

### New ServerMessage Types

```
ai-start → { type: 'ai-start', id: string, peerId: 'ai:deepseek', roomId: string, timestamp: number }
ai-chunk → { type: 'ai-chunk', id: string, text: string, roomId: string, timestamp: number }
ai-end   → { type: 'ai-end', id: string, roomId: string, timestamp: number }
ai-stop  → { type: 'ai-stop', id: string, roomId: string, timestamp: number }
```

### New ClientMessage Type

```
stop-ai → { type: 'stop-ai' }
```

### Flow

1. User sends message in DeepSeek room → server stores in DB, broadcasts to room (normal)
2. Server detects `roomId === 'deepseek'` → fetches last 20 messages as context
3. Calls `streamText` with conversation history via `createAnthropic`
4. Broadcasts `ai-start` → `ai-chunk` (per chunk) → `ai-end` (on completion)
5. On `ai-end`, stores the complete AI message in DB with `peerId = 'ai:deepseek'`

### Interruption Handling

- During AI generation, the client input is disabled; a "Stop" button is shown
- User clicks Stop → client sends `stop-ai` → server aborts the stream → broadcasts `ai-stop`
- The user's submitted message is kept; the incomplete AI message is discarded
- A system indicator shows that the generation was stopped
- After stop, the input is re-enabled for a new round

### Room Identification

`roomId === 'deepseek'` identifies the AI room. The seed plugin auto-creates this room. Can be extended to a `type` column on the `rooms` table later.

## Server-Side Changes

### `server/utils/ai.ts` (new)

Extract shared `createAnthropic` initialization from `deepseek-chat.ts`:

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

### `server/routes/_ws.ts`

New in-memory state:

```ts
const activeAiStreams = new Map<string, AbortController>()
```

On `chat` message in DeepSeek room:

1. Abort any existing stream for that room
2. Fetch last 20 messages from DB
3. Build conversation context: `peerId === 'ai:deepseek'` → `role: assistant`, others → `role: user`
4. Create AbortController, store in `activeAiStreams`
5. Call `streamText` with `deepseek('deepseek-v4-pro')`
6. On each chunk: broadcast `ai-chunk`
7. On complete: broadcast `ai-end`, store full AI message in DB
8. Remove controller from map

On `stop-ai` message:

1. Abort the controller for that room
2. Broadcast `ai-stop`
3. Remove controller from map

### `server/api/deepseek-chat.ts`

Refactor to import `getDeepSeekProvider` from `server/utils/ai.ts` instead of inline initialization.

### `server/plugins/seed.ts`

Add creation of the `deepseek` room alongside existing "General" and "Random" rooms.

## Client-Side Changes

### `app/types/chat.ts`

Add to `ServerMessage` union: `ai-start`, `ai-chunk`, `ai-end`, `ai-stop`
Add to `ClientMessage` union: `stop-ai`

### `app/stores/chat.ts`

New state:

- `isAiGenerating: boolean` — whether AI is currently streaming in the active room

New action handlers:

- `ai-start`: insert an empty AI message (`peerId: 'ai:deepseek'`), set `isAiGenerating = true`
- `ai-chunk`: append `text` to the matching message by id
- `ai-end`: set `isAiGenerating = false`
- `ai-stop`: remove the incomplete AI message, set `isAiGenerating = false`

### `app/composables/useChat.ts`

New method:

- `stopAi()`: sends `{ type: 'stop-ai' }` via WebSocket

### `app/components/chat/MessageBubble.vue`

AI message detection (`peerId === 'ai:deepseek'`):

- Robot icon avatar instead of user icon
- Label shows "DeepSeek"
- During generation: blinking cursor animation at the end of text

### `app/components/chat/MessageInput.vue`

- When `isAiGenerating` (from store): input disabled, "Stop" button shown instead of "Send"
- Stop button calls `stopAi()`

## File Change Summary

| File                                    | Change                                        |
| --------------------------------------- | --------------------------------------------- |
| `server/utils/ai.ts`                    | **New** — shared `getDeepSeekProvider()`      |
| `server/routes/_ws.ts`                  | Add AI stream handling + stop-ai logic        |
| `server/api/deepseek-chat.ts`           | Refactor to use shared provider               |
| `server/plugins/seed.ts`                | Auto-create DeepSeek room                     |
| `app/types/chat.ts`                     | New message types for AI protocol             |
| `app/stores/chat.ts`                    | `isAiGenerating` state + AI message handlers  |
| `app/composables/useChat.ts`            | New `stopAi()` method                         |
| `app/components/chat/MessageBubble.vue` | AI message visual distinction                 |
| `app/components/chat/MessageInput.vue`  | Disable input + stop button during generation |

## Future Extensions (out of scope)

- `type` column on `rooms` table for multiple AI room types
- `@deepseek` mention in regular rooms
- Configurable system prompt per AI room
- AI response to file/image messages
