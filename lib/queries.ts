import { and, eq } from 'drizzle-orm'
import type { AppDb } from './db/client'
import { contentItems, type ContentType } from './db/schema'

/**
 * 前台数据访问的唯一入口条件。
 * 所有前台查询必须经过它，避免未审核内容被读到。
 */
export function publishedOnly() {
  return eq(contentItems.status, 'published')
}

export async function listPublishedContent(db: AppDb, type?: ContentType) {
  return db
    .select()
    .from(contentItems)
    .where(type ? and(publishedOnly(), eq(contentItems.type, type)) : publishedOnly())
    .all()
}

export async function getPublishedBySlug(db: AppDb, slug: string) {
  const rows = await db
    .select()
    .from(contentItems)
    .where(and(publishedOnly(), eq(contentItems.slug, slug)))
    .limit(1)
    .all()
  return rows[0]
}
