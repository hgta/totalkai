import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/** 内容类型。后续 change 新增内容类型时需在此登记。 */
export const CONTENT_TYPES = ['wiki', 'assistant_profile', 'review_article'] as const
export type ContentType = (typeof CONTENT_TYPES)[number]

/** 发布状态。仅 published 对前台可见。 */
export const PUBLISH_STATUSES = ['draft', 'in-review', 'published'] as const
export type PublishStatus = (typeof PUBLISH_STATUSES)[number]

/**
 * 内容公共基表。各内容类型的专属字段放在独立扩展表中，
 * 通过 content_id 关联本表 id，以便 slug 唯一校验、
 * 审核后台统一列表与 sitemap 跨类型生成都能统一查询。
 */
export const contentItems = sqliteTable(
  'content_items',
  {
    id: text('id').primaryKey(),
    type: text('type').$type<ContentType>().notNull(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    status: text('status').$type<PublishStatus>().notNull().default('draft'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    publishedAt: integer('published_at'),
  },
  (t) => [
    uniqueIndex('content_items_slug_unique').on(t.slug),
    index('content_items_type_status_idx').on(t.type, t.status),
  ],
)
