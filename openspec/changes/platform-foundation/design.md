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

理由：回滚必须在数十秒内完成，且不能依赖重新构建。

### D9. 管理员入口：环境变量口令 + httpOnly 签名 Cookie

`/admin` 使用环境变量配置的管理员口令登录，session 为 httpOnly + signed cookie。

理由：MVP 只有一名运营者（用户本人），引入完整账号体系是过度设计。

备选：NextAuth——能力完整但配置量大，留给二期。

### D10. 健康检查端点 `/api/health`

返回应用存活状态与数据库可连接性，供 Caddy 上游检查与部署后验证使用。

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| 小内存 Linode 构建 OOM | 构建放在 CI/本地，服务器只跑产物（D5） |
| SQLite 单机写并发上限 | 平台读多写少；Drizzle 保留切换 Postgres 的能力 |
| 服务器磁盘故障导致数据丢失 | 每日定时拷贝 db 文件到备份目录，保留 N 天 |
| 发布失败导致站点不可用 | 版本目录 + 软链接回滚（D8），发布后自动健康检查，失败则自动回滚 |
| 内容 slug 冲突 | `content_items.slug` 唯一索引，冲突在写入期即报错 |
| pm2 自身异常导致无法自启 | 提供 systemd unit 作为备选方案写入运维文档 |

## Migration Plan

首次部署（无历史数据，无破坏性变更）：

1. 在 Linode 安装 Node 20+、pm2、Caddy
2. 配置 `totalk.ai` DNS 指向实例 IP
3. 创建 `/var/www/totalkai/releases`、`/var/www/totalkai/data` 目录
4. 本地/CI 执行 `next build`，打包 standalone 产物与 `public/`
5. 执行 `scripts/deploy.sh` 传输并解压到新版本目录
6. 运行数据库迁移，软链接切到新版本，`pm2 restart`
7. 访问 `/api/health` 与首页验证，Caddy 自动签发证书

回滚：将 `current` 软链接指回上一版本目录 → `pm2 restart totalkai` → 健康检查。

## Open Questions

1. Linode 实例的具体规格（CPU/内存/磁盘）与操作系统版本——影响构建策略与 pm2 实例数配置
2. 是否启用 GitHub Actions 构建（需要在仓库配置 SSH 私钥等 secrets），还是本地构建后手动发布
3. 管理员登录除口令外是否需要 IP 限制
4. 数据库备份目标是服务器本地目录还是对象存储
