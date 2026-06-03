import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

const { databaseUrl } = useRuntimeConfig()
const sql = postgres(databaseUrl)
const db = drizzle(sql, { schema })

export { sql, db }
