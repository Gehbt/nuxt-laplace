import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

function getDatabaseUrl() {
  try {
    return useRuntimeConfig().databaseUrl
  } catch {
    return process.env.NUXT_DATABASE_URL
  }
}

const sql = postgres(getDatabaseUrl()!)
const db = drizzle(sql, { schema })

export { sql, db }
