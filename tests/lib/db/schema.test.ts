import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import * as schema from '@/lib/db/schema'

const CREATE_TABLE = `
  CREATE TABLE content_items (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    published_at INTEGER
  );
  CREATE UNIQUE INDEX content_items_slug_unique ON content_items (slug);
  CREATE INDEX content_items_type_status_idx ON content_items (type, status);
`

function freshDb() {
  const sqlite = new Database(':memory:')
  sqlite.exec(CREATE_TABLE)
  return drizzle(sqlite, { schema })
}

const row = {
  id: 'c1',
  type: 'wiki' as const,
  slug: 'hello',
  title: '你好',
  status: 'draft' as const,
  createdAt: 1,
  updatedAt: 1,
  publishedAt: null,
}

describe('content_items', () => {
  let db: ReturnType<typeof freshDb>

  beforeEach(() => {
    db = freshDb()
  })

  it('可插入一条记录', () => {
    db.insert(schema.contentItems).values(row).run()
    expect(db.select().from(schema.contentItems).all()).toHaveLength(1)
  })

  it('重复 slug 触发唯一约束冲突', () => {
    db.insert(schema.contentItems).values(row).run()
    expect(() =>
      db.insert(schema.contentItems).values({ ...row, id: 'c2' }).run(),
    ).toThrow()
  })

  it('status 缺省为 draft', () => {
    db.insert(schema.contentItems).values({ ...row, status: undefined }).run()
    expect(db.select().from(schema.contentItems).all()[0].status).toBe('draft')
  })
})
