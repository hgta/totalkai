# platform-foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 totalk.ai 建立可上线、可重复发布的 Next.js 站点地基——应用骨架、内容数据层基线（含发布状态机）、以及 CI → Linode 的部署与回滚链路。

**Architecture:** 单体 Next.js 15 App Router 应用，SQLite + Drizzle 作为数据层，公共基表 `content_items` + 类型扩展表支撑跨类型查询。构建在 CI 完成，服务器只运行 standalone 产物；pm2 守护进程，宝塔面板管理的 Nginx 提供 HTTPS 与反代（因同机需托管多站点与数据库，避免与宝塔 Nginx 争抢 80/443）；发布采用「版本目录 + current 软链接」实现秒级回滚。

**Tech Stack:** Next.js 15 / React 19 / TypeScript strict / Tailwind CSS 3.4 / Drizzle ORM + better-sqlite3 / Zod / Vitest / pm2 / 宝塔面板(Nginx) / GitHub Actions

---

## Global Constraints

- Node 版本 ≥ 20（`engines` 在 `package.json` 中声明）
- TypeScript 严格模式开启，禁止 `any`
- `next build` 不得在 Linode 服务器上执行——构建只发生在 CI 或本地
- pm2 以**单实例 fork** 模式运行（2GB 机器），不得启用 cluster
- 所有前台数据访问必须过滤 `status === 'published'`
- `lib/` 不得 import React；`components/` 不得直接访问数据库
- 环境变量缺失必须在启动期失败，禁止静默降级
- 每个任务完成后提交一次，commit message 用中文说明设计意图
- 所有输出（注释、文档、commit message）使用简体中文
- 依赖版本已在实施时上调以消除高危漏洞：`next@15.5.28`（CVE-2025-66478）、`drizzle-orm@^0.45.4`（GHSA-gpj5-g38j-94v9 SQL 注入）、`zod@^4.6.7`、`postcss@^8.5.32`
- **已接受风险**：`next` 内嵌的 `postcss` 仍报高危（GHSA-qx2v-qp2m-jg93 等），修复需升级到 Next 16（破坏性大版本）。该 postcss 仅在构建期处理本项目自编的 CSS，不处理不可信输入，运行时无暴露面。记录在案，待后续大版本升级时消除。
- 因使用 zod 4，URL 校验写 `z.url()` 而非 `z.string().url()`
- 因使用 drizzle-orm 0.45，索引声明使用数组返回形式 `(t) => [ ... ]` 而非对象形式

---

## File Structure

| 路径 | 职责 |
|---|---|
| `package.json` | 依赖与脚本（dev/build/start/test/typecheck/lint/db:*） |
| `next.config.ts` | 开启 `output: 'standalone'` |
| `tsconfig.json` | strict 模式、路径别名 `@/*` |
| `postcss.config.mjs` / `tailwind.config.ts` | Tailwind 配置 |
| `lib/env.ts` | 环境变量 schema 与校验 |
| `lib/db/schema.ts` | `content_items` 表定义与类型常量 |
| `lib/db/client.ts` | Drizzle + better-sqlite3 连接（单例） |
| `lib/db/migrate.ts` | 迁移执行入口 |
| `lib/content-status.ts` | 发布状态机与合法流转 |
| `lib/queries.ts` | `publishedOnly` 过滤与前台查询函数 |
| `lib/admin-session.ts` | HMAC 签名 Cookie 的签发与校验 |
| `app/layout.tsx` | 根布局（字体、容器、页头、页脚） |
| `app/page.tsx` | 首页占位 |
| `app/not-found.tsx` | 404 页面 |
| `app/admin/layout.tsx` | 登录守卫 |
| `app/admin/login/page.tsx` | 口令登录页 |
| `app/admin/page.tsx` | 后台空态框架 |
| `app/api/health/route.ts` | 健康检查端点 |
| `components/site-header.tsx` | 主导航 + 移动端菜单 |
| `components/site-footer.tsx` | 页脚 |
| `components/empty-state.tsx` | 通用空态 |
| `scripts/nginx-reverse-proxy.conf` | Nginx 反代配置（证书由宝塔签发） |
| `ecosystem.config.cjs` | pm2 fork 单实例 |
| `scripts/deploy.sh` | 版本目录 + 软链接 + 健康检查 + 回滚 |
| `scripts/backup-db.sh` | 数据库备份与 7 天滚动清理 |
| `.github/workflows/ci.yml` | lint / typecheck / build / test |
| `.github/workflows/deploy.yml` | main 推送时构建并部署 |
| `DEPLOYMENT.md` | 运维文档（含 systemd 备选） |

---

## Task 1: 项目脚手架与依赖

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`, `.eslintrc.json`
- Test: `tests/smoke/node-version.test.ts`

**Interfaces:**
- Produces: 全项目可用的 `npm run dev|build|start|test|typecheck|lint`；后续任务依赖 `@/*` 路径别名与 Tailwind 指令

- [ ] **Step 1: 写失败测试**

```ts
// tests/smoke/node-version.test.ts
import { describe, expect, it } from 'vitest'

describe('运行环境', () => {
  it('Node 主版本号不低于 20', () => {
    expect(Number(process.versions.node.split('.')[0])).toBeGreaterThanOrEqual(20)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/smoke/node-version.test.ts`
Expected: FAIL（vitest 尚未安装）

- [ ] **Step 3: 写 package.json**

```json
{
  "name": "totalkai",
  "private": true,
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "node .next/standalone/server.js",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx lib/db/migrate.ts",
    "db:seed": "tsx scripts/seed-dev.ts"
  },
  "dependencies": {
    "next": "15.5.28",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "drizzle-orm": "^0.45.4",
    "better-sqlite3": "^11.7.0",
    "zod": "^4.6.7"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/better-sqlite3": "^7.6.12",
    "typescript": "^5.7.0",
    "tailwindcss": "^3.4.17",
    "postcss": "^8.5.32",
    "autoprefixer": "^10.4.20",
    "drizzle-kit": "^0.31.11",
    "tsx": "^4.19.0",
    "vitest": "^2.1.0",
    "eslint": "^9.17.0",
    "eslint-config-next": "15.5.28"
  }
}
```

- [ ] **Step 4: 写 next.config.ts 与 TS/Tailwind 配置**

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
}

export default nextConfig
```

`tsconfig.json` 需包含 `strict: true`、`paths: { "@/*": ["./*"] }`、`plugins: [{ "name": "next" }]`。
`tailwind.config.ts` 的 `content` 覆盖 `./app/**/*.{ts,tsx}`、`./components/**/*.{ts,tsx}`。

- [ ] **Step 5: 安装依赖**

Run: `npm install`
Expected: 安装成功，`node_modules` 生成

- [ ] **Step 6: 运行测试确认通过**

Run: `npx vitest run tests/smoke/node-version.test.ts`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add package.json tsconfig.json next.config.ts postcss.config.mjs tailwind.config.ts .eslintrc.json tests/ package-lock.json
git commit -m "chore: 初始化 Next.js 15 项目脚手架与依赖"
```

---

## Task 2: 环境变量校验

**Files:**
- Create: `lib/env.ts`, `.env.example`
- Test: `tests/lib/env.test.ts`

**Interfaces:**
- Produces: `getEnv(): Env`、`loadEnv(source?): Env`；后续 db client 与 admin-session 均消费 `getEnv()`

- [ ] **Step 1: 写失败测试**

```ts
// tests/lib/env.test.ts
import { describe, expect, it } from 'vitest'
import { loadEnv } from '@/lib/env'

const base = {
  DATABASE_PATH: '/tmp/test.db',
  SITE_URL: 'https://totalk.ai',
  ADMIN_PASSWORD: 'password123',
  SESSION_SECRET: 'a'.repeat(32),
}

describe('loadEnv', () => {
  it('变量完整时返回解析结果', () => {
    expect(loadEnv(base)).toMatchObject({ SITE_URL: 'https://totalk.ai' })
  })

  it('缺少 DATABASE_PATH 时抛错并指明变量名', () => {
    const { DATABASE_PATH, ...rest } = base
    expect(() => loadEnv(rest)).toThrow(/DATABASE_PATH/)
  })

  it('SITE_URL 非法时抛错', () => {
    expect(() => loadEnv({ ...base, SITE_URL: 'not-a-url' })).toThrow(/SITE_URL/)
  })

  it('PORT 缺省为 3000', () => {
    expect(loadEnv(base).PORT).toBe(3000)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/lib/env.test.ts`
Expected: FAIL（`@/lib/env` 不存在）

- [ ] **Step 3: 实现**

```ts
// lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_PATH: z.string().min(1),
  SITE_URL: z.url(),
  ADMIN_PASSWORD: z.string().min(8),
  SESSION_SECRET: z.string().min(16),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    throw new Error(`环境变量缺失或非法: ${detail}`)
  }
  return parsed.data
}

let cached: Env | null = null

export function getEnv(): Env {
  if (!cached) cached = loadEnv()
  return cached
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/lib/env.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/env.ts .env.example tests/lib/env.test.ts
git commit -m "feat: 增加启动期环境变量校验，缺失即失败"
```

---

## Task 3: 数据层 schema 与连接

**Files:**
- Create: `lib/db/schema.ts`, `lib/db/client.ts`, `lib/db/migrate.ts`, `drizzle.config.ts`
- Test: `tests/lib/db/schema.test.ts`

**Interfaces:**
- Consumes: `getEnv().DATABASE_PATH`
- Produces: `db`（Drizzle 实例）、`contentItems` 表、`CONTENT_TYPES`、`PUBLISH_STATUSES`、`ContentType`、`PublishStatus`；Task 4/5 依赖这些导出

- [ ] **Step 1: 写失败测试**

```ts
// tests/lib/db/schema.test.ts
import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { contentItems } from '@/lib/db/schema'

function freshDb() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
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
  `)
  return drizzle(sqlite)
}

describe('content_items', () => {
  it('可插入一条记录', () => {
    const db = freshDb()
    db.insert(contentItems).values({
      id: 'c1', type: 'wiki', slug: 'hello', title: '你好',
      status: 'draft', createdAt: 1, updatedAt: 1, publishedAt: null,
    }).run()
    expect(db.select().from(contentItems).all()).toHaveLength(1)
  })

  it('重复 slug 触发唯一约束冲突', () => {
    const db = freshDb()
    const row = {
      id: 'c1', type: 'wiki' as const, slug: 'dup', title: 'D',
      status: 'draft' as const, createdAt: 1, updatedAt: 1, publishedAt: null,
    }
    db.insert(contentItems).values(row).run()
    expect(() =>
      db.insert(contentItems).values({ ...row, id: 'c2' }).run()
    ).toThrow()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/lib/db/schema.test.ts`
Expected: FAIL（`@/lib/db/schema` 不存在）

- [ ] **Step 3: 实现 schema**

```ts
// lib/db/schema.ts
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const CONTENT_TYPES = ['wiki', 'assistant_profile', 'review_article'] as const
export type ContentType = (typeof CONTENT_TYPES)[number]

export const PUBLISH_STATUSES = ['draft', 'in-review', 'published'] as const
export type PublishStatus = (typeof PUBLISH_STATUSES)[number]

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
```

- [ ] **Step 4: 实现 client 与 migrate**

`lib/db/client.ts` 用 `getEnv().DATABASE_PATH` 创建 better-sqlite3 连接并导出单例 `db`，同时执行 `PRAGMA journal_mode = WAL`。
`lib/db/migrate.ts` 调用 `drizzle-orm/better-sqlite3/migrator` 的 `migrate()`，`migrationsFolder` 指向 `./drizzle`。
`drizzle.config.ts` 声明 `dialect: 'sqlite'`、`schema: './lib/db/schema.ts'`、`out: './drizzle'`、`dbCredentials.url` 取自 `process.env.DATABASE_PATH`。

- [ ] **Step 5: 生成迁移产物**

Run: `npm run db:generate`
Expected: `drizzle/` 目录生成 SQL 迁移文件

- [ ] **Step 6: 运行确认通过**

Run: `npx vitest run tests/lib/db/schema.test.ts`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add lib/db drizzle.config.ts drizzle tests/lib/db
git commit -m "feat: 建立 content_items 公共基表与 Drizzle 迁移"
```

---

## Task 4: 发布状态机

**Files:**
- Create: `lib/content-status.ts`
- Test: `tests/lib/content-status.test.ts`

**Interfaces:**
- Consumes: `PublishStatus`（Task 3）
- Produces: `canTransition`、`assertTransition`、`isPublished`、`applyTransition`；Task 5 与后续 change 的审核后台依赖

- [ ] **Step 1: 写失败测试**

```ts
// tests/lib/content-status.test.ts
import { describe, expect, it } from 'vitest'
import { applyTransition, assertTransition, canTransition, isPublished } from '@/lib/content-status'

describe('发布状态机', () => {
  it('draft 可提交为 in-review', () => {
    expect(canTransition('draft', 'in-review')).toBe(true)
  })

  it('draft 不可直接变为 published', () => {
    expect(canTransition('draft', 'published')).toBe(false)
    expect(() => assertTransition('draft', 'published')).toThrow(/draft -> published/)
  })

  it('in-review 可通过或打回', () => {
    expect(canTransition('in-review', 'published')).toBe(true)
    expect(canTransition('in-review', 'draft')).toBe(true)
  })

  it('published 可下架为 draft', () => {
    expect(canTransition('published', 'draft')).toBe(true)
  })

  it('applyTransition 更新状态与时间戳', () => {
    const next = applyTransition({ status: 'draft', updatedAt: 1 }, 'in-review', 2)
    expect(next).toEqual({ status: 'in-review', updatedAt: 2 })
  })

  it('isPublished 仅对 published 为真', () => {
    expect(isPublished('published')).toBe(true)
    expect(isPublished('draft')).toBe(false)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/lib/content-status.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// lib/content-status.ts
import type { PublishStatus } from './db/schema'

const TRANSITIONS: Record<PublishStatus, readonly PublishStatus[]> = {
  draft: ['in-review'],
  'in-review': ['published', 'draft'],
  published: ['draft'],
}

export function canTransition(from: PublishStatus, to: PublishStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function assertTransition(from: PublishStatus, to: PublishStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`非法的发布状态流转: ${from} -> ${to}`)
  }
}

export function isPublished(status: PublishStatus): boolean {
  return status === 'published'
}

export function applyTransition(
  current: { status: PublishStatus; updatedAt: number },
  to: PublishStatus,
  now: number,
): { status: PublishStatus; updatedAt: number } {
  assertTransition(current.status, to)
  return { status: to, updatedAt: now }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/lib/content-status.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/content-status.ts tests/lib/content-status.test.ts
git commit -m "feat: 实现发布状态机与合法流转校验"
```

---

## Task 5: 前台查询过滤

**Files:**
- Create: `lib/queries.ts`
- Test: `tests/lib/queries.test.ts`

**Interfaces:**
- Consumes: `db`、`contentItems`、`ContentType`（Task 3）
- Produces: `listPublishedContent(type?)`、`getPublishedBySlug(slug)`；Task 6/7 的页面依赖

- [ ] **Step 1: 写失败测试**

```ts
// tests/lib/queries.test.ts
import { beforeAll, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { contentItems } from '@/lib/db/schema'
import { getPublishedBySlug, listPublishedContent } from '@/lib/queries'

let db: ReturnType<typeof drizzle>

beforeAll(() => {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE content_items (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, slug TEXT NOT NULL,
      title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, published_at INTEGER
    );
  `)
  db = drizzle(sqlite)
  db.insert(contentItems).values([
    { id: '1', type: 'wiki', slug: 'pub-1', title: '已发布', status: 'published', createdAt: 1, updatedAt: 1, publishedAt: 1 },
    { id: '2', type: 'wiki', slug: 'draft-1', title: '草稿', status: 'draft', createdAt: 1, updatedAt: 1, publishedAt: null },
    { id: '3', type: 'review_article', slug: 'pub-2', title: '文章', status: 'published', createdAt: 1, updatedAt: 1, publishedAt: 1 },
  ]).run()
})

describe('前台查询', () => {
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
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/lib/queries.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// lib/queries.ts
import { and, eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { contentItems, type ContentType } from './db/schema'

type DB = BetterSQLite3Database<Record<string, never>>

export function publishedOnly() {
  return eq(contentItems.status, 'published')
}

export async function listPublishedContent(db: DB, type?: ContentType) {
  return db
    .select()
    .from(contentItems)
    .where(type ? and(publishedOnly(), eq(contentItems.type, type)) : publishedOnly())
    .all()
}

export async function getPublishedBySlug(db: DB, slug: string) {
  const rows = await db
    .select()
    .from(contentItems)
    .where(and(publishedOnly(), eq(contentItems.slug, slug)))
    .limit(1)
    .all()
  return rows[0]
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/lib/queries.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/queries.ts tests/lib/queries.test.ts
git commit -m "feat: 实现 publishedOnly 前台查询过滤"
```

---

## Task 6: 站点骨架（布局、导航、空态）

**Files:**
- Create: `app/layout.tsx`, `app/globals.css`, `components/site-header.tsx`, `components/site-footer.tsx`, `components/empty-state.tsx`

**Interfaces:**
- Consumes: Tailwind 样式令牌
- Produces: 全站根布局与导航；Task 7 页面依赖

- [ ] **Step 1: 实现根布局**

`app/layout.tsx` 导出 `metadata`（title 模板、description、OG 默认图）与 `RootLayout`，内部渲染 `<SiteHeader />`、`<main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>`、`<SiteFooter />`。

- [ ] **Step 2: 实现页头与移动端菜单**

`components/site-header.tsx` 为客户端组件，桌面端横向展示「首页 / 评测知识库 / 助手档案 / 评测文章」导航项（后三项 MVP 阶段指向占位锚点），移动端通过按钮切换展开。

- [ ] **Step 3: 实现空态组件**

```tsx
// components/empty-state.tsx
export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}
    </div>
  )
}
```

- [ ] **Step 4: 提交**

```bash
git add app/layout.tsx app/globals.css components/
git commit -m "feat: 建立全局布局、主导航与空态组件"
```

---

## Task 7: 首页、404 与元数据

**Files:**
- Create: `app/page.tsx`, `app/not-found.tsx`

**Interfaces:**
- Consumes: `EmptyState`（Task 6）、`listPublishedContent`（Task 5）

- [ ] **Step 1: 实现首页**

`app/page.tsx` 使用 `listPublishedContent(db)`；有内容则渲染列表，为空则渲染 `EmptyState`。首屏需展示站点定位说明「中文 AI 购物助手评测知识与评测内容平台」与评测罗盘预告区（九维度名称的静态展示）。数据库不可用时仍返回 200 并展示空态，不得抛错。

- [ ] **Step 2: 实现 404**

`app/not-found.tsx` 返回 404 提示与返回首页链接。

- [ ] **Step 3: 本地验证**

Run: `npm run dev`，访问 `/` 与 `/no-such-page`
Expected: 首页 200 且展示定位与空态；`/no-such-page` 返回 404 页面

- [ ] **Step 4: 提交**

```bash
git add app/page.tsx app/not-found.tsx
git commit -m "feat: 实现首页占位与 404 页面"
```

---

## Task 8: 健康检查端点

**Files:**
- Create: `app/api/health/route.ts`
- Test: `tests/api/health.test.ts`

**Interfaces:**
- Produces: `GET /api/health` 返回 `{ status, database, timestamp }`；`scripts/deploy.sh` 依赖此端点做发布后校验

- [ ] **Step 1: 写失败测试**

```ts
// tests/api/health.test.ts
import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/health/route'

describe('GET /api/health', () => {
  it('数据库可用时返回 ok', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.database).toBe('ok')
  })

  it('数据库不可用时返回 503', async () => {
    const res = await GET({ probe: () => false } as never)
    expect(res.status).toBe(503)
    expect((await res.json()).database).toBe('error')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/api/health.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`GET` 默认探针为「对 `content_items` 执行一次 `select 1` 查询」；捕获异常后返回 503 且 `database: 'error'`。支持注入可选 `probe` 参数以便测试（生产默认行为不变）。

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/api/health.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add app/api/health tests/api
git commit -m "feat: 增加健康检查端点，反映应用与数据库状态"
```

---

## Task 9: 管理后台与会话

**Files:**
- Create: `lib/admin-session.ts`, `app/admin/layout.tsx`, `app/admin/login/page.tsx`, `app/admin/page.tsx`
- Test: `tests/lib/admin-session.test.ts`

**Interfaces:**
- Consumes: `getEnv().ADMIN_PASSWORD`、`getEnv().SESSION_SECRET`
- Produces: `signSession()`、`verifySession()`；`app/admin/layout.tsx` 依赖其做守卫

- [ ] **Step 1: 写失败测试**

```ts
// tests/lib/admin-session.test.ts
import { describe, expect, it } from 'vitest'
import { signSession, verifySession } from '@/lib/admin-session'

const secret = 'test-secret-at-least-16-chars'

describe('管理会话', () => {
  it('签发的 token 可被校验通过', () => {
    expect(verifySession(signSession(secret), secret)).toBe(true)
  })

  it('密钥不同则校验失败', () => {
    expect(verifySession(signSession(secret), 'another-secret-at-least-16')).toBe(false)
  })

  it('被篡改的 token 校验失败', () => {
    const token = signSession(secret)
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')
    expect(verifySession(tampered, secret)).toBe(false)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/lib/admin-session.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现会话签名**

```ts
// lib/admin-session.ts
import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'totalk_admin'

export function signSession(secret: string, issuedAt = Date.now()): string {
  const payload = Buffer.from(String(issuedAt)).toString('base64url')
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifySession(token: string | undefined, secret: string): boolean {
  if (!token) return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
```

- [ ] **Step 4: 实现登录页与守卫**

`app/admin/login/page.tsx` 提供口令表单，提交后由 Server Action 校验 `ADMIN_PASSWORD`，成功则写入 `SESSION_COOKIE`（`httpOnly`、`sameSite=lax`、`secure`、`maxAge` 12 小时）并重定向到 `/admin`，失败返回错误提示且不签发 Cookie。
`app/admin/layout.tsx` 读取 Cookie，未通过 `verifySession` 则 `redirect('/admin/login')`。
`app/admin/page.tsx` 渲染空态框架，说明后续 change 会在此接入各内容类型的审核队列。

- [ ] **Step 5: 运行确认通过**

Run: `npx vitest run tests/lib/admin-session.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add lib/admin-session.ts app/admin tests/lib/admin-session.test.ts
git commit -m "feat: 增加管理后台口令登录与签名会话守卫"
```

---

## Task 10: 部署资产

**Files:**
- Create: `scripts/nginx-reverse-proxy.conf`, `ecosystem.config.cjs`, `scripts/deploy.sh`, `scripts/backup-db.sh`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `DEPLOYMENT.md`

**Interfaces:**
- Consumes: `/api/health`（Task 8）、standalone 产物（Task 1 的 `output: 'standalone'`）

- [ ] **Step 1: 写 Nginx 反向代理配置**

`scripts/nginx-reverse-proxy.conf`：反代到 `127.0.0.1:3000`，并传递
`Host` / `X-Real-IP` / `X-Forwarded-*` 头。其中 `X-Forwarded-Proto $scheme` 是必须的——
缺失会导致 Next.js 误判请求为 http，生成的链接和登录跳转都会出错。

- [ ] **Step 2: 写 pm2 配置**

```js
// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'totalkai',
      script: './server.js',
      cwd: '/var/www/totalkai/current',
      exec_mode: 'fork',
      instances: 1,
      env: { NODE_ENV: 'production' },
    },
  ],
}
```

- [ ] **Step 3: 写部署脚本**

`scripts/deploy.sh` 严格按顺序执行：解压到 `releases/<timestamp>` → 确认 `data/` 持久化目录存在 → 执行数据库迁移（失败即 `exit 1`，不切换）→ 软链接 `current` → `pm2 restart totalkai` → 最多轮询 30 次 `/api/health`（间隔 2 秒）→ 失败则软链接回退上一版本并重启后 `exit 1` → 成功则 `pm2 save` 并清理旧版本保留最近 5 个。

- [ ] **Step 4: 写备份脚本**

`scripts/backup-db.sh` 将数据库文件按日期拷贝到 `/var/www/totalkai/backups/db-<YYYYMMDD>.db`，并删除 7 天前的备份。

- [ ] **Step 5: 写 CI workflow**

`.github/workflows/ci.yml`：在 pull request 与 push 时执行 `npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run build`。
`.github/workflows/deploy.yml`：仅在 main 推送时触发，先复用 ci 的全部步骤，再打包 `.next/standalone`、`.next/static`、`public`、`package.json`，通过 `appleboy/scp-action` 传输并用 `appleboy/ssh-action` 执行 `deploy.sh`。所需 secrets：`LINODE_HOST`、`LINODE_USER`、`LINODE_SSH_KEY`。

- [ ] **Step 6: 写运维文档**

`DEPLOYMENT.md` 说明：服务器前置条件（Node 20+、pm2、宝塔面板）、目录结构、首次部署步骤、回滚步骤、备份与恢复、宝塔相关注意事项、以及 systemd unit 的备选方案。

- [ ] **Step 7: 提交**

```bash
git add scripts ecosystem.config.cjs .github DEPLOYMENT.md
git commit -m "feat: 建立 Nginx/pm2/部署脚本与 CI 发布链路"
```

---

## Task 11: 构建验证与上线

**Files:**
- Modify: 无新增文件；必要时修正上述文件

- [ ] **Step 1: 运行完整门禁**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: 全部通过，`.next/standalone/server.js` 生成

- [ ] **Step 2: 本地启动产物验证**

Run: `cp .next/static .next/standalone/.next/ -Recursive; cp public .next/standalone/ -Recursive; node .next/standalone/server.js`
Expected: 首页可访问且 `/api/health` 返回 `{"status":"ok","database":"ok"}`

- [ ] **Step 3: Linode 首次部署**

按 `DEPLOYMENT.md` 在服务器上准备目录与依赖，配置仓库 secrets 后推送 main 触发部署。
Expected: `https://totalk.ai` 返回 200，`http://` 跳转 `https://`

- [ ] **Step 4: 验证守护与自启**

Run: `pm2 kill` 后观察进程恢复；`pm2 save && pm2 startup` 确认开机自启已注册
Expected: 进程被 pm2 重新拉起

- [ ] **Step 5: 回滚演练**

Run: 手动将 `current` 软链接指回上一版本目录并 `pm2 restart totalkai`
Expected: 站点恢复到上一版本且可访问

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "chore: 完成构建验证与上线检查项"
```

---

## 覆盖检查

| tasks.md 任务 | 对应计划任务 |
|---|---|
| 1.1–1.4 项目初始化 | Task 1、Task 2 |
| 2.1–2.5 数据层基线 | Task 3、Task 4、Task 5 |
| 3.1–3.5 站点骨架 | Task 6、Task 7 |
| 4.1–4.3 管理与健康检查 | Task 8、Task 9 |
| 5.1–5.7 部署链路 | Task 10 |
| 6.1–6.4 验证与上线 | Task 11 |
