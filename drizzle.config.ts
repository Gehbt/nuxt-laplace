/// <reference types="node" />
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/database/schema.ts',
  out: './migrations',
  dbCredentials: {
    url: process.env.NUXT_DATABASE_URL!,
  },
})
