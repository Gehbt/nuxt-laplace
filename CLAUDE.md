# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- Nuxt 4 (Vue 3) with TypeScript
- Nuxt UI with Tailwind CSS 4
- Pinia for state management
- Vercel AI SDK (`ai`, `@ai-sdk/deepseek`, `@ai-sdk/vue`)
- PostgreSQL with Drizzle ORM
- `crossws` for WebSocket
- Bun as package manager (use `bun` not `npm` or `pnpm` locally)

## Commands

- `bun run dev` — start dev server on port 4331
- `bun run build` — production build
- `bun run lint` — oxlint + ESLint
- `bun run typecheck` — TypeScript type checking
- `bun run test:unit` — unit tests only (test/unit, node environment)
- `bun run test:nuxt` — Nuxt integration tests only (test/nuxt, happy-dom)
- `bun run test` — run all tests
- `bun run db:generate` — generate Drizzle migrations
- `bun run db:migrate` — run database migrations
- `bun run db:push` — push schema to database

## Code Style

- Formatter: oxfmt (not prettier) — no semicolons, single quotes
- Linter: oxlint + ESLint via @nuxt/eslint
- 2-space indentation (set in .editorconfig)
- ESLint overrides: no comma dangle, no single-line HTML element content newlines, HTML self-closing allowed

## Architecture

- `app/` — frontend (pages, components, composables, stores, types)
- `server/database/` — Drizzle schema (`schema.ts`) and client (`client.ts`)
- `server/repositories/` — data access layer (room, message)
- `server/routes/_ws.ts` — WebSocket server (chat relay, presence, AI triggers)
- `server/utils/ai.ts` — AI integration (DeepSeek via Vercel AI SDK)
- `server/utils/storage.ts` — file storage utilities
- `app/composables/useChat.ts` — WebSocket client with auto-reconnect
- `app/composables/useChatCache.ts` — IndexedDB message cache (idb)
- `app/stores/chat.ts` — Pinia store for chat state

## Environment Variables

Defined in `.env.example`:

- `NUXT_DATABASE_URL` — PostgreSQL connection string
- `NUXT_AI_GATEWAY_API_KEY` — AI Gateway API key (optional)
- `NUXT_DEEPSEEK_API_KEY` — DeepSeek API key
- `NUXT_DEEPSEEK_BASE_URL` — DeepSeek base URL (optional)
