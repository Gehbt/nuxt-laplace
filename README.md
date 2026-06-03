# Laplace

Real-time chat application with AI-powered conversations, built with Nuxt 4.

## Features

- **Real-time multi-user chat** — WebSocket-based rooms with typing indicators and user presence
- **AI chat** — DeepSeek AI integration with streaming responses and configurable model settings
- **Message persistence** — PostgreSQL storage via Drizzle ORM, IndexedDB client-side cache
- **Dark mode** — Full dark mode support via Nuxt UI and Tailwind CSS 4

## Tech Stack

- Nuxt 4 (Vue 3) + TypeScript
- Nuxt UI + Tailwind CSS 4
- Pinia for state management
- Vercel AI SDK (`ai`, `@ai-sdk/deepseek`, `@ai-sdk/vue`)
- PostgreSQL + Drizzle ORM
- `crossws` for WebSocket
- Bun (package manager)

## Setup

Install dependencies:

```bash
bun install
```

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable                  | Description                   |
| ------------------------- | ----------------------------- |
| `NUXT_DATABASE_URL`       | PostgreSQL connection string  |
| `NUXT_AI_GATEWAY_API_KEY` | AI Gateway API key (optional) |
| `NUXT_DEEPSEEK_API_KEY`   | DeepSeek API key              |
| `NUXT_DEEPSEEK_BASE_URL`  | DeepSeek base URL (optional)  |

Run database migrations:

```bash
bun run db:migrate
```

## Development

Start the dev server on `http://localhost:4331`:

```bash
bun run dev
```

## Production

```bash
bun run build
bun run preview
```

## Commands

| Command               | Description                        |
| --------------------- | ---------------------------------- |
| `bun run dev`         | Start dev server (port 4331)       |
| `bun run build`       | Production build                   |
| `bun run lint`        | oxlint + ESLint                    |
| `bun run typecheck`   | TypeScript type checking           |
| `bun run test`        | Run all tests                      |
| `bun run test:unit`   | Unit tests only (node environment) |
| `bun run test:nuxt`   | Nuxt integration tests (happy-dom) |
| `bun run db:generate` | Generate Drizzle migrations        |
| `bun run db:migrate`  | Run database migrations            |
| `bun run db:push`     | Push schema to database            |

## Project Structure

```
app/                  # Frontend (Nuxt pages, components, composables, stores)
  components/         # Vue components
  composables/        # Vue composables (useChat, useChatCache)
  pages/              # File-based routing
  stores/             # Pinia stores
  types/              # TypeScript type definitions
server/               # Backend (Nitro)
  database/           # Drizzle schema and client
  repositories/       # Data access layer
  routes/             # WebSocket and API routes
  utils/              # Server utilities (AI, storage)
test/                 # Test suites
  unit/               # Unit tests
  nuxt/               # Nuxt integration tests
migrations/           # Database migrations
```
