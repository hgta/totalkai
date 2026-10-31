---
comet_change: platform-foundation
role: technical-design
canonical_spec: openspec
---

# totalk.ai 站点地基技术设计

## Context

`totalkai` 仓库为空，需要为「中文 AI 购物助手评测交流平台 totalk.ai」建立可上线、可重复发布的应用地基。后续两个 change（评测知识库、助手档案与评测文章）全部依赖本 change。

已确认的约束：

- Linode 2GB 实例，域名 `totalk.ai` 已解析
- 单机部署，运维成本必须极低
- 构建不得在服务器上执行（2GB 机器构建 Next.js 有 OOM 风险）
- 内容为读多写少，且必须经过人工审核
- 平台是内容站，SEO 是一等公民

canonical spec 位于 `openspec/changes/platform-foundation/specs/`，本文件只描述 HOW，不重复需求。

## Goals / Non-Goals

**Goals**

- 交付可运行、可访问、可自愈的 Next.js 站点骨架
- 建立可扩展的内容数据层基线（统一 slug 唯一性与发布状态）
- 建立可重复执行、可快速回滚的 Linode 发布链路
- 使后续业务 change 只关心页面与内容模型

**Non-Goals**

- 任何具体业务页面（知识库、档案、文章属后续 change）
- 公开用户注册体系
- 多机/分布式部署、容器编排
- 数据库高可用方案

## 架构

### 目录结构与职责边界

```
totalkai/
├─ app/
│  ├─ layout.tsx              根布局：字体、容器、页头、页脚
│  ├─ page.tsx                首页占位（站点定位 + 评测罗盘预告区）
│  ├─ not-found.tsx           404
│  ├─ admin/
│  │  ├─ layout.tsx           登录守卫（未登录 → /admin/login）
│  │  ├─ login/page.tsx       口令登录
│  │  └─ page.tsx             空态框架（后续 change 填内容类型）
│  └─ api/health/route.ts     应用存活 + 数据库连通性
├─ components/                site-header / site-footer / empty-state
├─ lib/
│  ├─ env.ts                  环境变量校验（缺失即启动失败）
│  ├─ db/{client,schema,migrate}.ts
│  ├─ content-status.ts       状态枚举 + 合法流转
│  ├─ queries.ts              publishedOnly()
│  └─ admin-session.ts        Cookie 签发与校验
├─ scripts/{deploy.sh,backup-db.sh}
├─ ecosystem.config.cjs       pm2 fork 单实例
├─ Caddyfile
├─ .github/workflows/{ci.yml,deploy.yml}
└─ DEPLOYMENT.md
```

边界原则：`lib/` 不感知 React；`components/` 不直接访问数据库；路由层只做编排与 404 判定。每个单元职责单一，可独立理解与测试。

## 数据层

### 表结构

`content_items` 公共基表：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | TEXT PK | UUID |
| `type` | TEXT | `wiki` / `assistant_profile` / `review_article` |
| `slug` | TEXT | 全局唯一 |
| `title` | TEXT | |
| `status` | TEXT | `draft` / `in-review` / `published` |
| `created_at` / `updated_at` / `published_at` | INTEGER | 时间戳 |

索引：`slug` 唯一索引；`(type, status)` 复合索引。

各内容类型的专属字段放在独立扩展表中，通过 `content_id` 关联 `content_items.id`。选择此结构而非各类型独立表，是因为 slug 全局唯一校验、审核后台统一列表、sitemap 跨类型生成都需要跨类型查询——独立表方案会让这三处各写一份 UNION 逻辑。

### 发布状态机

```
draft ──提交──▶ in-review ──通过──▶ published
  ▲                 │                    │
  └──────打回───────┘        下架 ────────┘
```

合法流转：`draft→in-review`、`in-review→published`、`in-review→draft`、`published→draft`。其余流转抛错。

前台所有查询强制经过 `publishedOnly()`；路由层对非 published 内容调用 `notFound()`。双重设防，避免后续新增页面时遗漏过滤。

### 迁移

Drizzle 迁移产物纳入版本库，由部署脚本执行。迁移失败即中止部署，不进入版本切换。迁移幂等，重复执行不产生变更。

## 部署链路

### CI

`.github/workflows/deploy.yml` 在 main 分支推送时触发：

```
checkout → Node 20 → npm ci → lint + typecheck → next build
  → 打包 standalone + static + public → scp → ssh deploy.sh
```

门禁任一失败即中止，不执行部署。

### 部署脚本

`scripts/deploy.sh` 在服务器上执行：

1. 解压到 `releases/<timestamp>`
2. 数据库与 `.env` 位于持久化目录 `data/`，不随版本目录变动
3. 执行 Drizzle 迁移，失败即中止
4. 软链接 `current` → 新版本
5. `pm2 restart`
6. 轮询 `/api/health`；失败则软链接回退上一版本并重启，以非 0 退出
7. 清理旧版本，保留最近 5 个

回滚路径即「软链接指回上一版本 + `pm2 restart`」，数十秒内完成，不依赖重新构建。

### 运行时

- Caddy：自动 HTTPS + 反代到应用端口，HTTP 跳转 HTTPS
- pm2：2GB 机器使用 fork 单实例，不启用 cluster
- 备份：每日备份数据库到服务器本地目录，滚动保留 7 天

## 访问控制

环境变量：`DATABASE_PATH`、`SITE_URL`、`ADMIN_PASSWORD`、`SESSION_SECRET`、`PORT`。`lib/env.ts` 在启动期统一校验，缺失即失败并输出明确错误，不静默降级。

`/admin` 会话 Cookie：HMAC 签名（密钥取 `SESSION_SECRET`）、`httpOnly`、`sameSite=lax`、`secure`、12 小时过期。未登录访问重定向到登录页。

## 测试策略

- **门禁**：CI 的 lint + typecheck + build，任一失败阻断部署
- **单元测试**：状态机流转合法性、`publishedOnly()` 过滤行为、环境变量校验、Cookie 签名与校验
- **部署冒烟**：`/api/health` 校验应用与数据库连通、首页返回 200、`/admin` 未登录跳转、登录后返回 200
- **回滚演练**：验证阶段实际执行一次回滚，确认软链接切换与 pm2 重启生效
- **HTTPS 验证**：确认 Caddy 自动签发证书且 HTTP 跳转 HTTPS

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| 2GB 机器构建 OOM | 构建固定在 CI，服务器只运行产物 |
| SQLite 单机写并发上限 | 平台读多写少；Drizzle 保留切换 Postgres 方言的能力 |
| 磁盘故障导致数据丢失 | 本地滚动备份 7 天 |
| 发布失败导致站点不可用 | 版本目录 + 软链接回滚；健康检查失败自动回滚 |
| slug 冲突 | `content_items.slug` 唯一索引，写入期即报错 |
| 未审核内容被前台读到 | 查询层 `publishedOnly()` + 路由层 `notFound()` 双重设防 |
| pm2 自身异常 | `DEPLOYMENT.md` 提供 systemd unit 备选方案 |
| 环境变量缺失导致运行期异常 | 启动期校验，缺失即失败 |

## 实施备注

- 本 change 的 `specs` 产物（三个 delta spec）是 canonical spec，验收以其中的 Scenario 为准
- 后续 change 新建扩展表时，必须同时写入 `content_items` 记录，否则审核后台与 sitemap 无法覆盖
- 首页的评测罗盘预告区在 `assistant-profiles-and-reviews` 中会替换为真实维度导航
