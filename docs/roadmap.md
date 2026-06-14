# Laplace Project Roadmap

Generated: 2026-06-11

## Current State

Laplace is a real-time chat platform built on Nuxt 4 with:

- **WebSocket real-time chat** (room-based, with online presence)
- **DeepSeek AI integration** (streaming responses, configurable thinking modes)
- **IndexedDB offline cache** (max 200 messages per room)
- **PostgreSQL + Drizzle ORM** data layer
- **Anonymous access** (no auth system, peer ID as identity)

Architecture layers: `repositories → database schema → server routes/api → WebSocket → composables/stores → components/pages`

---

## 1. User System & Identity

**Current gap**: No authentication at all. Each connection gets a random `peerId` that changes on refresh. No usernames, avatars, or profiles.

**Directions**:

- Lightweight auth (OAuth / email / passkey) — optional anonymous mode
- Persistent user identity, avatars, online status
- Direct messages (DMs) — currently only room-based chat, no peer-to-peer messaging
- @mentions, user search

**Why it matters**: This is the critical boundary between "demo" and "product." Without identity, nearly all social features are impossible to build.

---

## 2. Multi-Model AI & Agents

**Current state**: `package.json` already has `@ai-sdk/anthropic` and `@ai-sdk/moonshot`, but only DeepSeek is wired in code. AI is currently just a single-turn chat tool.

**Directions**:

- **Multi-model switching** — Claude, GPT, Moonshot, etc., selectable in settings
- **AI Agent system** — Give AI tool-calling capabilities (search, code execution, file operations), not just conversation
- **MCP (Model Context Protocol) integration** — Let AI access external tools and data sources
- **Context management in AI rooms** — Currently only 20-message context; add summarization, long-term memory
- **Code sandbox** — Run AI-generated code in browser (WebContainer) or server (Docker)

---

## 3. Message Enrichment

**Current state**: Messages are plain text `content: text`. No formatting, attachments, or special message types.

**Directions**:

- **Markdown rendering** (syntax-highlighted code blocks)
- **Message type system** — text, image, file, system notification, card
- **Message replies / threading** — Slack-style threaded discussions on a message
- **Reactions** — Emoji reactions on messages
- **File/image upload** — `server/utils/storage.ts` has foundations but isn't wired into chat
- **Link previews** — Auto-generate OpenGraph cards from URLs
- **Code block execution** — Especially relevant in AI rooms; users can run AI-generated code directly

---

## 4. Room & Community Management

**Current state**: Rooms only have `id` + `name`, with three seed rooms. No management features.

**Directions**:

- Room settings (description, avatar, public/private)
- Room members & roles (owner / admin / member)
- Message moderation & reporting
- Room search & discovery
- Room invite links
- Channel categories (Discord-style server/channel organization)

---

## 5. Search & Persistence

**Current state**: Messages are stored in PostgreSQL, but the client relies on IndexedDB cache (max 200 messages). No full-text search on the server.

**Directions**:

- Server-side message search (full-text index / pg_trgm / Elasticsearch)
- Message history browsing (infinite scroll — `server/api/rooms/[roomId]/messages.get.ts` supports `before` pagination param but frontend doesn't use it)
- AI conversation history management (currently stored in localStorage; lost on device switch)
- Pinned messages, bookmarks/favorites

---

## 6. Real-time Experience Enhancement

**Directions**:

- **Audio/video calls** (WebRTC) — voice channels within rooms
- **Screen sharing**
- **Collaborative editing** — Multi-user real-time document/code editing
- **Whiteboard** — Visual collaboration
- **Finer-grained presence** — Typing indicators per room, "viewing room X," idle/away states

---

## 7. Deployment & Engineering

**Directions**:

- **Multi-tenant / SaaS model** — If productizing
- **Rate limiting & security** — No message frequency limits on WebSocket currently
- **Test coverage improvement** — Current tests are basic; core logic (WebSocket handler, AI streaming, reconnection) lacks depth
- **Monitoring & observability** — Structured logging, WebSocket connection metrics, AI call tracing
- **CI/CD pipeline**
- **i18n / internationalization**

---

## Suggested Evolution Order

By dependency (foundation → advanced):

1. **User system** → Foundation for all social features
2. **Message enrichment** (Markdown + file upload + threading) → Core chat experience upgrade
3. **Search & history** → Make existing content discoverable
4. **Multi-model AI / Agents** → Differentiating competitive advantage
5. **Room management** → Required at scale
6. **Audio/video / real-time collaboration** → Nice-to-have enhancement
