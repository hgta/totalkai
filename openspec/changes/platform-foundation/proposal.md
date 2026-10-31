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
