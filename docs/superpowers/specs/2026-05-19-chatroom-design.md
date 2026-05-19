# Chat Room Application Design

Multi-room anonymous chat application with WebSocket communication and JSON file persistence.

## Stack

- **WebSocket**: crossws (via Nitro `defineWebSocketHandler`)
- **Storage**: unstorage with `fs` driver (JSON files)
- **Frontend**: Nuxt UI components + Pinia
- **Runtime**: Nuxt 4 / Nitro

## Data Model

### Message

```ts
interface ChatMessage {
  id: string // UUID
  content: string
  peerId: string // sender ID assigned by crossws
  timestamp: number // Date.now()
}
```

### Room

```ts
interface Room {
  id: string // sluggified name
  name: string // display name
}
```

### Storage Layout

```
data/
  rooms                → Room[] (room list)
  messages/general     → ChatMessage[]
  messages/random      → ChatMessage[]
  ...
```

Each key stored as a JSON file by the unstorage `fs` driver.

## WebSocket Protocol

All messages are JSON. The server uses crossws topics for room-based pub/sub.

### Client → Server

| Type          | Fields                    | Description                                       |
| ------------- | ------------------------- | ------------------------------------------------- |
| `join`        | `roomId`                  | Join a room (subscribe to topic, receive history) |
| `chat`        | `content`                 | Send a chat message to current room               |
| `typing`      | —                         | Notify others user is typing                      |
| `history`     | `roomId, before?, limit?` | Request message history                           |
| `create-room` | `name`                    | Create a new room                                 |

### Server → Client

| Type           | Fields                    | Description              |
| -------------- | ------------------------- | ------------------------ |
| `welcome`      | `peerId`                  | Assigned on connection   |
| `chat`         | `message: ChatMessage`    | New message in room      |
| `typing`       | `peerId`                  | Someone is typing        |
| `user-joined`  | `peerId, onlineUsers`     | User joined room         |
| `user-left`    | `peerId, onlineUsers`     | User left room           |
| `history`      | `messages: ChatMessage[]` | Historical messages      |
| `room-created` | `room: Room`              | New room created         |
| `rooms`        | `rooms: Room[]`           | Room list (sent on join) |

### Connection Flow

1. Client opens WebSocket to `/api/chat`
2. Server sends `welcome` with `peerId`
3. Client sends `join` with `roomId`
4. Server subscribes peer to topic `room:{roomId}`, sends `history` + `rooms` + `user-joined` broadcast
5. Normal message exchange via pub/sub

## Server Architecture

### File Structure

```
server/
  utils/
    storage.ts       → unstorage instance + message/room CRUD
  api/
    chat.ws.ts       → crossws WebSocket handler
```

### storage.ts

Wraps unstorage with typed helpers:

- `getRooms()`: read room list from storage
- `createRoom(name)`: create and persist a new room
- `getMessages(roomId, before?, limit?)`: load message history (sorted by timestamp, paginated)
- `addMessage(roomId, msg)`: append message and persist

Uses `createStorage({ driver: fsDriver({ base: './data' }) })`.

### chat.ws.ts

Crossws hooks via Nitro `defineWebSocketHandler`:

- **upgrade**: No auth (anonymous), sets namespace from URL path
- **open**: Send `welcome`, assign to lobby
- **message**: Dispatch by `type` field, call storage layer, broadcast via `peer.publish`
- **close**: Clean up online state, broadcast `user-left`

### In-Memory State (not persisted)

```ts
const onlineUsers = new Map<string, Set<string>>() // roomId → peerIds
const peerRooms = new Map<string, string>() // peerId → currentRoomId
```

Reset on server restart. No REST API routes — all interaction via WebSocket.

## Frontend Architecture

### File Structure

```
app/
  pages/
    index.vue              → Landing / room list entry
    chat/
      [roomId].vue         → Chat room page
  components/
    chat/
      MessageList.vue      → Scrollable message list
      MessageInput.vue     → Text input + send button
      MessageBubble.vue    → Single message bubble
      RoomSidebar.vue      → Left sidebar: rooms + online users
      TypingIndicator.vue  → "Someone is typing..." display
  composables/
    useChat.ts             → WebSocket connection + message send/receive
  stores/
    chat.ts                → Pinia store: messages, rooms, online users, connection state
```

### Layout

```
┌──────────────────────────────────────┐
│  RoomSidebar  │     Chat Area        │
│  ┌──────────┐ │  ┌────────────────┐  │
│  │ #general  │ │  │  MessageList   │  │
│  │ #random   │ │  │                │  │
│  │ ...       │ │  │  Typing...     │  │
│  ├──────────┤ │  ├────────────────┤  │
│  │ Online   │ │  │  MessageInput  │  │
│  │ peer-abc │ │  └────────────────┘  │
│  │ peer-def │ │                      │
│  └──────────┘ │                      │
└──────────────────────────────────────┘
```

### useChat Composable

- Manages WebSocket lifecycle (connect, auto-reconnect, disconnect)
- Sends typed messages (join, chat, typing, history, create-room)
- Receives server messages and updates Pinia store via callbacks

### Pinia Store (chat.ts)

State:

- `currentRoomId`: active room
- `messages`: Map<roomId, ChatMessage[]>
- `rooms`: Room[]
- `onlineUsers`: Map<roomId, string[]>
- `typingPeerId`: currently typing peer (debounced)
- `connected`: boolean

### Components

All built with Nuxt UI (UContainer, UInput, UButton, UScrollArea, UCard, etc.).

- **MessageList**: Renders messages for current room, auto-scrolls to bottom on new message
- **MessageInput**: UInput with send on Enter, emits `typing` on input with debounce
- **MessageBubble**: Shows content + truncated peerId + relative timestamp
- **RoomSidebar**: Clickable room list + online user count per room
- **TypingIndicator**: Shows when a peer is typing, clears after 3s timeout

## Dependencies to Install

- `unstorage` — Key-value storage with fs driver
- `crossws` — WebSocket server (likely already available via Nitro, but explicit dependency)

No other new libraries needed.
