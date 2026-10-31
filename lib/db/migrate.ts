import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { getDb } from './client'

const migrationsFolder = process.env.MIGRATIONS_FOLDER ?? './drizzle'

migrate(getDb(), { migrationsFolder })
console.log(`数据库迁移完成: ${migrationsFolder}`)
