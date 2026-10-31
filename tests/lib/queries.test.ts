import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import * as schema from '@/lib/db/schema'
import { getPublishedBySlug, listPublishedContent } from '@/lib/queries'

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
`

function freshDb() {
  const sqlite = new Database(':memory:')
  sqlite.exec(CREATE_TABLE)
  return drizzle(sqlite, { schema })
}

describe('前台查询', () => {
  let db: ReturnType<typeof freshDb>

  beforeEach(() => {
    db = freshDb()
    db.insert(schema.contentItems)
      .values([
        { id: '1', type: 'wiki', slug: 'pub-1', title: '已发布', status: 'published', createdAt: 1, updatedAt: 1, publishedAt: 1 },
        { id: '2', type: 'wiki', slug: 'draft-1', title: '草稿', status: 'draft', createdAt: 1, updatedAt: 1, publishedAt: null },
        { id: '3', type: 'review_article', slug: 'pub-2', title: '文章', status: 'published', createdAt: 1, updatedAt: 1, publishedAt: 1 },
        { id: '4', type: 'wiki', slug: 'review-1', title: '待审', status: 'in-review', createdAt: 1, updatedAt: 1, publishedAt: null },
      ])
      .run()
  })

  it('列表仅返回已发布内容', async () => {
    const rows = await listPublishedContent(db)
    expect(rows.map((r) => r.slug).sort()).toEqual(['pub-1', 'pub-2'])
  })

  it('可按类型过滤', async () => {
    const rows = await listPublishedContent(db, 'wiki')
    expect(rows).toHaveLength(1)
    expect(rows[0].slug).toBe('pub-1')
  })

  it('按 slug 取已发布内容', async () => {
    expect((await getPublishedBySlug(db, 'pub-1'))?.title).toBe('已发布')
  })

  it('草稿按 slug 查询返回 undefined', async () => {
    expect(await getPublishedBySlug(db, 'draft-1')).toBeUndefined()
  })

  it('待审内容按 slug 查询返回 undefined', async () => {
    expect(await getPublishedBySlug(db, 'review-1')).toBeUndefined()
  })
})
