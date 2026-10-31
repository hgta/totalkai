# Brainstorm Summary

- Change: platform-foundation
- Date: 2026-10-31

## 确认的技术方案

### 已确认决策（用户在 brainstorming 中明确选择）

1. **部署方式**：GitHub Actions CI 构建 + SSH 部署。推送 main 自动构建并部署，需在仓库配置 SSH 私钥等 secrets。
2. **表结构**：公共基表 `content_items` + 类型扩展表。slug 唯一性、审核后台统一列表、sitemap 跨类型生成均依赖跨类型查询，接受多一层 join 的代价。
3. **实例规格**：Linode 2GB。pm2 使用单实例 fork 模式，构建外部化（CI 执行），服务器只运行产物。
4. **后台防护**：环境变量口令 + httpOnly 签名 Cookie session。零依赖，满足单人运营的 MVP 需求。

### 沿用 open 阶段已确认的设计决策

5. Next.js 15 App Router + TypeScript + Tailwind（SEO 需要 SSR/SSG）
6. SQLite + Drizzle ORM + better-sqlite3
7. 构建在 CI，服务器只跑 standalone 产物（避免 2GB 机器构建 OOM）
8. Caddy 自动 HTTPS + 反向代理
9. pm2 守护 + 开机自启
10. 版本目录 + 软链接切换实现发布与回滚
11. 发布状态机 `draft → in-review → published`，查询层与路由层双重设防
12. 健康检查端点 `/api/health`

### 本轮设计新增的确定项

13. **备份策略**（原为 open question，本轮确定）：备份到服务器本地目录，滚动保留 7 天。理由：2GB 机器、数据量小，本地滚动备份足以覆盖误删与库损坏场景，避免引入对象存储的额外配置与成本。
14. **环境变量清单**：`DATABASE_PATH`、`SITE_URL`、`ADMIN_PASSWORD`、`SESSION_SECRET`、`PORT`。缺失时启动即失败并明确报错，不允许静默降级。
15. **迁移策略**：Drizzle 迁移产物纳入版本库，部署时由部署脚本执行；迁移失败则中止部署并回滚。

## 关键取舍与风险

| 风险 | 缓解 |
|---|---|
| 2GB 机器构建 OOM | 构建固定在 CI，服务器只运行产物 |
| SQLite 单机写并发上限 | 平台读多写少；Drizzle 保留切换 Postgres 方言的能力 |
| 磁盘故障导致数据丢失 | 本地滚动备份 7 天 |
| 发布失败导致站点不可用 | 版本目录 + 软链接回滚；部署后健康检查失败自动回滚 |
| slug 冲突 | `content_items.slug` 唯一索引，写入期即报错 |
| 未审核内容被前台读到 | `publishedOnly()` 查询层过滤 + 路由层 `notFound()` 双重设防 |
| pm2 自身异常 | 运维文档中提供 systemd 备选方案 |
| 环境变量缺失导致运行期异常 | 启动期校验，缺失即失败 |

## 测试策略

- **门禁**：CI 执行类型检查、lint、`next build`，任一失败即阻断部署
- **单元测试**：状态机流转合法性、`publishedOnly()` 过滤行为、环境变量校验、Cookie 签名与校验
- **部署冒烟**：部署后访问 `/api/health`（校验应用与数据库连通）、首页返回 200、`/admin` 未登录跳转登录页、登录后返回 200
- **回滚演练**：在验证阶段实际执行一次回滚，确认软链接切换与 pm2 重启生效
- **HTTPS 验证**：确认 Caddy 自动签发证书且 HTTP 跳转 HTTPS

## Spec Patch

将新建三个 capability 的 delta spec（当前 `specs` 产物仍为 ready，尚无文件）：

- `openspec/changes/platform-foundation/specs/site-shell/spec.md`
- `openspec/changes/platform-foundation/specs/content-repository/spec.md`
- `openspec/changes/platform-foundation/specs/deployment-pipeline/spec.md`

三个 delta spec 均使用 `## ADDED Requirements`，每个 requirement 至少附带一个 `#### Scenario`。
