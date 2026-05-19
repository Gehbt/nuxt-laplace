---
name: verify
description: Run lint, typecheck, and all tests in sequence to verify changes before committing. Use when the user says /verify or asks to check if their changes are ready.
---

Run the following commands in order. Stop at the first failure and report what went wrong.

1. `bun run lint`
2. `bun run typecheck`
3. `bun run test`

If all pass, report success with a brief summary of each step's result.
