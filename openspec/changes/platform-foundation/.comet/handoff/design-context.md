# Comet Design Handoff

- Change: platform-foundation
- Phase: design
- Mode: compact
- Context hash: 2e21a97ab31244cb81f6be199cfa45b1367ff908f6244a38622a6917bd64ed78

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/platform-foundation/proposal.md

- Source: openspec/changes/platform-foundation/proposal.md
- Lines: 1-31
- SHA256: ffdc5cf8840838308139bb6eb5bd59fecca66ac5c2cd1905eab9bb8433b1c858

```md
## Why

totalk.ai 需要一个能立刻上线、并能持续承载内容的站点地基。当前仓库为空，没有任何可运行的应用、数据层或发布链路，后续的评测知识库、助手档案与评测文章都无处落地。同时 Linode 实例与域名 `totalk.ai` 均已就绪，用户希望尽快看到线上站点——因此地基必须先把「能跑、能部署、能持续发布」三件事立住，而不是先堆业务页面。

## What Changes

- 初始化 Next.js 15（App Router + TypeScript + Tailwind）应用骨架，建立 totalk.ai 的全局布局、导航与首页占位
- 建立 SQLite + Drizzle 数据层基线：统一内容表结构，内置发布状态（`draft` / `in-review` / `published`）、创建与更新时间、slug 唯一约束
- 建立生产部署链路：Caddy 自动 HTTPS 反向代理、pm2 进程守护与开机自启、Linode 发布脚本（本地或 CI 构建 → 传输 standalone 产物 → 平滑重启）、健康检查端点
- 建立 CI：推送主分支时执行构建与类型校验
- 提供本地一键开发启动与 `.env.example` 环境变量样例

## Capabilities

### New Capabilities

- `site-shell`: 站点骨架——全局布局、主导航、首页、404 与空态处理、全站元信息
- `content-repository`: 内容数据层基线——SQLite/Drizzle schema、迁移、种子机制与发布状态字段
- `deployment-pipeline`: 生产部署链路——standalone 构建产物、Caddy 反代与 HTTPS、pm2 守护、Linode 发布脚本与健康检查

### Modified Capabilities

（无。当前仓库为空，不存在需要修改的既有 capability。）

## Impact

- 新增应用代码与依赖：`next`、`react`、`drizzle-orm`、`better-sqlite3`、`tailwindcss` 等
- 新增部署资产：`Caddyfile`、`ecosystem.config.cjs`、`scripts/deploy.sh`、`.env.example`
- 服务器侧：Linode 实例需具备 Node 20+、pm2、Caddy；域名 `totalk.ai` 需解析到该实例
- 数据库为服务器本地文件，需纳入备份策略（备份即拷贝 db 文件）
- 构建策略：在 CI 或本地执行 `next build`，服务器仅运行产物，避免小内存实例构建时 OOM
```

## openspec/changes/platform-foundation/design.md

- Source: openspec/changes/platform-foundation/design.md
- Lines: 1-125
- SHA256: 3451334ce2481c96bc661ffca882785fc6a028309cc846a9cd298a0e1a49cb0b

[TRUNCATED]

```md
## Context

`totalkai` 仓库当前完全为空（仅有 git 元数据，无提交）。Linode 实例与域名 `totalk.ai` 均已就绪，用户希望尽快看到线上站点。后续两个 change（评测知识库、助手档案与评测文章）全部依赖本 change 提供的应用骨架、数据层与发布链路。

约束条件：

- 单机部署，运维成本必须极低
- Linode 实例内存规格未知（可能是 1–4GB 的小机型），不能在服务器上执行 Next.js 构建
- 内容为读多写少，且需要草稿态/审核态
- 平台定位是内容站，SEO 是一等公民

## Goals / Non-Goals

**Goals:**

- 交付一个可运行、可访问、可重启自愈的 Next.js 站点骨架
- 建立可扩展的内容数据层基线（统一 slug 唯一性与发布状态）
- 建立一条可重复执行、可回滚的 Linode 发布链路
- 使后续业务 change 只需关心页面与内容模型，不再处理基础设施

**Non-Goals:**

- 任何具体业务页面（知识库、档案、文章均在后续 change）
- 公开用户注册与登录体系
- 多机/分布式部署、容器编排
- 数据库高可用方案（单机 SQLite 足够）

## Decisions

### D1. 全栈框架：Next.js 15 App Router + TypeScript + Tailwind

理由：内容站强依赖 SEO，需要服务端渲染与静态生成能力；App Router 的 `sitemap.ts` / `robots.ts` / Metadata API 开箱可用；单体部署心智负担最低。

备选方案：

- Astro 静态站——SEO 极佳且产物更小，但社区与审核后台等动态能力后续会受限
- Vite + SPA——首屏与收录表现差，直接排除

### D2. 数据层：SQLite + Drizzle ORM + better-sqlite3

理由：单机免运维，备份就是拷贝一个文件；Drizzle 的类型安全与迁移工具完善，且未来切 Postgres 只需换方言。平台读多写少，SQLite 完全够用。

备选：PostgreSQL + Docker Compose——更规范，但为 MVP 引入额外容器与运维成本，收益不匹配。

### D3. 内容表结构：公共基表 + 类型扩展表

建立 `content_items` 公共基表承载跨类型字段（`id`、`type`、`slug`、`title`、`status`、`created_at`、`updated_at`、`published_at`），各内容类型的专属字段放在独立扩展表中，通过 `content_id` 关联。

理由：slug 全局唯一性校验、审核后台的统一列表、sitemap 的跨类型生成，都需要跨内容类型查询。若各类型完全独立建表，这三处都要写多份 UNION 逻辑。

备选：各类型独立表 + 重复状态字段——写入更简单，但跨类型查询退化，审核后台与 sitemap 成本翻倍。

### D4. 发布状态机：draft → in-review → published

`status` 字段三态，仅 `published` 对前台可见。状态流转集中在 `lib/content-status.ts`，前台查询统一走 `publishedOnly()` 过滤，杜绝遗漏。

理由：平台内容由 AI 生成，必须经过人工审核，状态机必须是一等约束而非约定。

### D5. 构建在 CI/本地，服务器只运行产物

`next build` 输出 standalone 产物，通过脚本传输到服务器，服务器只执行 `node server.js`。

理由：小内存 Linode 上构建 Next.js 容易 OOM，且构建会占用线上资源。产物体积也可通过排除 devDependencies 控制。

备选：服务器上 `git pull && npm ci && npm run build`——链路短但风险高，排除。

### D6. 反向代理：Caddy（自动 HTTPS）

Caddyfile 数行配置即可获得自动签发与续期证书。

备选：Nginx + certbot——能力等价但配置量与续期维护成本明显更高。

### D7. 进程守护：pm2 + 开机自启

`ecosystem.config.cjs` + `pm2 save` + `pm2 startup` 实现崩溃重启与开机自启。备选 systemd 更规范，可作为后续增强，不作为 MVP 阻塞项。

### D8. 发布与回滚：版本目录 + 软链接切换

服务器保留 `/var/www/totalkai/releases/<timestamp>` 多个版本，当前版本通过软链接 `current` 指向；回滚即改软链接指向上一版本并 `pm2 restart`。

```

Full source: openspec/changes/platform-foundation/design.md

## openspec/changes/platform-foundation/tasks.md

- Source: openspec/changes/platform-foundation/tasks.md
- Lines: 1-45
- SHA256: 169bd79b3e371f4e0d528f26223dad32aaa53bd370268f5febf2c1254717b906

```md
## 1. 项目初始化

- [ ] 1.1 初始化 Next.js 15 项目（App Router + TypeScript）并安装核心依赖
- [ ] 1.2 配置 Tailwind CSS 与全站基础样式令牌
- [ ] 1.3 配置 ESLint、TypeScript strict 模式与路径别名
- [ ] 1.4 编写 `.env.example` 与环境变量校验模块

## 2. 数据层基线

- [ ] 2.1 配置 Drizzle + better-sqlite3 连接与迁移脚本
- [ ] 2.2 定义 `content_items` 公共基表（type/slug/title/status/时间戳）与 slug 唯一索引
- [ ] 2.3 定义发布状态枚举与状态流转模块 `lib/content-status.ts`
- [ ] 2.4 实现 `publishedOnly()` 查询过滤辅助函数
- [ ] 2.5 编写数据库初始化与本地开发种子命令

## 3. 站点骨架

- [ ] 3.1 实现根布局（字体、容器、页头页脚）
- [ ] 3.2 实现主导航与移动端响应式菜单
- [ ] 3.3 实现首页占位（站点定位介绍 + 评测罗盘预告区）
- [ ] 3.4 配置全站 Metadata 默认值与 OG 默认图
- [ ] 3.5 实现 404 页面与通用空态组件

## 4. 管理与健康检查

- [ ] 4.1 实现 `/api/health` 健康检查端点（含数据库连通性）
- [ ] 4.2 实现 `/admin` 口令登录与 httpOnly 签名 Cookie session
- [ ] 4.3 实现 `/admin` 空态框架页（供后续 change 填充内容类型）

## 5. 部署链路

- [ ] 5.1 配置 `next.config` 输出 standalone 产物
- [ ] 5.2 编写 Caddyfile（自动 HTTPS + 反向代理）
- [ ] 5.3 编写 pm2 `ecosystem.config.cjs` 与开机自启说明
- [ ] 5.4 编写 `scripts/deploy.sh`（传输 → 新版本目录 → 迁移 → 切软链接 → 重启 → 健康检查 → 失败自动回滚）
- [ ] 5.5 编写数据库定时备份脚本
- [ ] 5.6 配置 GitHub Actions CI（安装依赖 → 类型检查 → 构建）
- [ ] 5.7 编写 `DEPLOYMENT.md` 运维文档

## 6. 验证与上线

- [ ] 6.1 本地构建与启动验证
- [ ] 6.2 在 Linode 执行首次部署并验证 HTTPS 可访问
- [ ] 6.3 验证 pm2 崩溃重启与开机自启
- [ ] 6.4 验证版本回滚流程
```

## openspec/changes/platform-foundation/specs/content-repository/spec.md

- Source: openspec/changes/platform-foundation/specs/content-repository/spec.md
- Lines: 1-61
- SHA256: 02bc50b0ca8dc56c2d25129fae2765435e414ebb364e83dbde4068baba4f804b

```md
## ADDED Requirements

### Requirement: 内容公共基表结构与唯一 slug

系统 SHALL 提供 `content_items` 公共基表，包含 `id`、`type`、`slug`、`title`、`status`、`created_at`、`updated_at`、`published_at` 字段，并对 `slug` 施加唯一约束。

#### Scenario: 插入重复 slug

- **WHEN** 写入一条 slug 与既有记录相同的 `content_items` 记录
- **THEN** 写入失败并返回唯一约束冲突错误

#### Scenario: 按类型与状态查询

- **WHEN** 按 `type` 与 `status` 组合查询内容
- **THEN** 查询命中 `(type, status)` 复合索引并返回匹配记录

### Requirement: 发布状态机与合法流转

系统 SHALL 维护 `draft`、`in-review`、`published` 三态，仅允许 `draft→in-review`、`in-review→published`、`in-review→draft`、`published→draft` 四种流转。

#### Scenario: 执行合法流转

- **WHEN** 将一条 `draft` 记录提交为 `in-review`
- **THEN** 状态变更为 `in-review` 且 `updated_at` 被更新

#### Scenario: 执行非法流转

- **WHEN** 尝试将一条 `draft` 记录直接变更为 `published`
- **THEN** 系统抛出错误且记录状态保持不变

### Requirement: 前台查询仅返回已发布内容

系统 SHALL 保证所有前台数据访问仅返回 `status` 为 `published` 的记录。

#### Scenario: 前台查询时存在草稿

- **WHEN** 数据库中同时存在 `draft` 与 `published` 记录且执行前台列表查询
- **THEN** 查询结果仅包含 `published` 记录

#### Scenario: 直接访问未发布内容的 URL

- **WHEN** 访客直接访问一条 `draft` 记录对应的详情 URL
- **THEN** 系统返回 404，不展示该内容

### Requirement: 数据库迁移可重复执行

系统 SHALL 提供可重复执行的迁移命令，已应用过的迁移不得重复执行。

#### Scenario: 连续两次执行迁移

- **WHEN** 在同一数据库上连续执行两次迁移命令
- **THEN** 第二次执行不产生结构变更且不报错

### Requirement: 环境变量缺失时启动失败

系统 SHALL 在启动时校验必需环境变量，缺失时立即失败并输出指明缺失变量的错误。

#### Scenario: 缺少 DATABASE_PATH 时启动应用

- **WHEN** 在未设置 `DATABASE_PATH` 的情况下启动应用
- **THEN** 应用启动失败并输出指明该变量缺失的错误信息
```

## openspec/changes/platform-foundation/specs/deployment-pipeline/spec.md

- Source: openspec/changes/platform-foundation/specs/deployment-pipeline/spec.md
- Lines: 1-107
- SHA256: ff7735962d2f334beda43cd9ab27dc2849e7dee980bd021c7ee5ab241ac23d82

[TRUNCATED]

```md
## ADDED Requirements

### Requirement: 构建产物为 standalone 且不在线上构建

系统 SHALL 以 standalone 模式输出构建产物，且 `next build` 不得在 Linode 服务器上执行。

#### Scenario: 在 CI 中执行构建

- **WHEN** 在 CI 环境中执行构建
- **THEN** 产出 standalone 产物，且服务器部署流程不包含构建步骤

### Requirement: 推送主分支触发构建与部署

系统 SHALL 在 main 分支收到推送时执行测试门禁与构建，全部通过后部署到 Linode。

#### Scenario: 推送 main 分支

- **WHEN** 向 main 分支推送提交
- **THEN** CI 依次执行 lint、类型检查与构建，全部通过后执行部署

#### Scenario: 门禁失败

- **WHEN** CI 中 lint 或类型检查失败
- **THEN** 流程中止且不执行部署

### Requirement: 部署使用版本目录与软链接切换

系统 SHALL 将每次部署放入独立版本目录，并通过 `current` 软链接指向生效版本。

#### Scenario: 连续两次部署

- **WHEN** 连续执行两次部署
- **THEN** 服务器上存在两个版本目录且 `current` 指向最新版本

### Requirement: 部署后健康检查失败自动回滚

系统 SHALL 在切换版本后执行健康检查，失败时自动将 `current` 回退到上一版本并重启服务，且部署命令以非 0 状态退出。

#### Scenario: 新版本健康检查失败

- **WHEN** 新版本部署后健康检查连续失败
- **THEN** `current` 软链接回退到上一版本、服务被重启、部署命令返回非 0

#### Scenario: 数据库迁移失败

- **WHEN** 部署过程中数据库迁移失败
- **THEN** 流程中止且 `current` 仍指向原版本

### Requirement: pm2 保证进程守护与开机自启

系统 SHALL 使用 pm2 以单实例 fork 模式运行应用，保证进程崩溃后自动重启并在服务器开机后自启。

#### Scenario: 应用进程崩溃

- **WHEN** 应用进程异常退出
- **THEN** pm2 自动重启该进程

### Requirement: Caddy 提供 HTTPS 与反向代理

系统 SHALL 通过 Caddy 对外提供 HTTPS，将请求反向代理到应用端口，并将 HTTP 请求跳转到 HTTPS。

#### Scenario: 通过 HTTP 访问站点

- **WHEN** 访客以 http:// 访问站点
- **THEN** 请求被跳转到 https:// 并返回站点内容

### Requirement: 健康检查端点反映应用与数据库状态

系统 SHALL 提供 `/api/health`，在应用存活且数据库可连接时返回健康状态，否则返回非健康状态。

#### Scenario: 数据库不可连接

- **WHEN** 数据库文件不可访问时请求 `/api/health`
- **THEN** 端点返回非健康状态并指明数据库不可用

### Requirement: 数据库定时备份

系统 SHALL 每日备份数据库到服务器本地目录，并滚动保留 7 天。

#### Scenario: 执行备份
```

Full source: openspec/changes/platform-foundation/specs/deployment-pipeline/spec.md

## openspec/changes/platform-foundation/specs/site-shell/spec.md

- Source: openspec/changes/platform-foundation/specs/site-shell/spec.md
- Lines: 1-51
- SHA256: 97382c187862c98ea86226fc70b3760405cd4093ab325a25b337befb235c825b

```md
## ADDED Requirements

### Requirement: 站点提供全局布局与导航

系统 SHALL 为所有页面提供统一的根布局，包含页头主导航与页脚，并在小屏幕视口下提供可用的移动端导航。

#### Scenario: 桌面端访问任意页面

- **WHEN** 访客在桌面视口访问站点任意页面
- **THEN** 页面渲染统一页头（含主导航）与页脚

#### Scenario: 移动端展开导航

- **WHEN** 访客在移动视口点击导航触发按钮
- **THEN** 导航菜单展开且其中链接可点击

### Requirement: 首页展示站点定位

系统 SHALL 在首页展示站点定位说明与评测罗盘预告区，明确本站为「中文 AI 购物助手评测知识与评测内容平台」。

#### Scenario: 访客首次访问首页

- **WHEN** 访客访问站点根路径
- **THEN** 页面展示站点定位说明与评测罗盘预告区

### Requirement: 未知路径返回 404

系统 SHALL 对不存在的路径返回 404 状态码并渲染 404 页面。

#### Scenario: 访问不存在的路径

- **WHEN** 访客访问 `/no-such-page`
- **THEN** 系统返回 HTTP 404 并渲染 404 页面

### Requirement: 全站提供默认元信息与 OG 图

系统 SHALL 为所有页面设置默认 title、description 与 OG 图，且允许页面覆盖这些值。

#### Scenario: 页面未显式声明 Metadata

- **WHEN** 某页面未声明自身 Metadata
- **THEN** 页面仍输出站点级默认 title、description 与 OG 图

### Requirement: 内容为空时展示空态而非报错

系统 SHALL 在任意内容列表为空时渲染空态提示，不得抛出异常或渲染空白页。

#### Scenario: 数据表为空时访问首页

- **WHEN** 数据库中无任何内容记录时访客访问首页
- **THEN** 页面正常渲染并展示空态提示，且 HTTP 状态码为 200
```

