import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { getEnv } from '../env'
import * as schema from './schema'

function createClient() {
  const { DATABASE_PATH } = getEnv()
  mkdirSync(dirname(DATABASE_PATH), { recursive: true })
  const sqlite = new Database(DATABASE_PATH)
  sqlite.pragma('journal_mode = WAL')
  return drizzle(sqlite, { schema })
}

export type AppDb = ReturnType<typeof createClient>

let cached: AppDb | null = null

export function getDb(): AppDb {
  if (!cached) {
    cached = createClient()
  }
  return cached
}
