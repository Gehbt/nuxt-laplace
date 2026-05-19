# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- Nuxt 4 (Vue 3) with TypeScript 6
- Nuxt UI with Tailwind CSS 4
- Pinia for state management
- Bun as package manager (use `bun` not `npm` or `pnpm` locally)

## Commands

- `bun run dev` — start dev server on port 4331
- `bun run build` — production build
- `bun run lint` — oxlint + ESLint
- `bun run typecheck` — TypeScript type checking
- `bun run test:unit` — unit tests only (test/unit, node environment)
- `bun run test:nuxt` — Nuxt integration tests only (test/nuxt, happy-dom)
- `bun run test` — run all tests

## Code Style

- Formatter: oxfmt (not prettier) — no semicolons, single quotes
- Linter: oxlint + ESLint via @nuxt/eslint
- 2-space indentation (set in .editorconfig)
- ESLint overrides: no comma dangle, no single-line HTML element content newlines, HTML self-closing allowed
