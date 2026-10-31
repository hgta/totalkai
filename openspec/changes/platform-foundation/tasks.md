## 1. 项目初始化

- [x] 1.1 初始化 Next.js 15 项目（App Router + TypeScript）并安装核心依赖
- [x] 1.2 配置 Tailwind CSS 与全站基础样式令牌
- [x] 1.3 配置 ESLint、TypeScript strict 模式与路径别名
- [x] 1.4 编写 `.env.example` 与环境变量校验模块

## 2. 数据层基线

- [x] 2.1 配置 Drizzle + better-sqlite3 连接与迁移脚本
- [x] 2.2 定义 `content_items` 公共基表（type/slug/title/status/时间戳）与 slug 唯一索引
- [x] 2.3 定义发布状态枚举与状态流转模块 `lib/content-status.ts`
- [x] 2.4 实现 `publishedOnly()` 查询过滤辅助函数
- [x] 2.5 编写数据库初始化命令（迁移在应用启动时由 `instrumentation.ts` 执行；当前尚无内容表可填充，本地种子命令未引入）

## 3. 站点骨架

- [x] 3.1 实现根布局（字体、容器、页头页脚）
- [x] 3.2 实现主导航与移动端响应式菜单
- [x] 3.3 实现首页占位（站点定位介绍 + 评测罗盘预告区）
- [x] 3.4 配置全站 Metadata 默认值与 OG 默认图
- [x] 3.5 实现 404 页面与通用空态组件

## 4. 管理与健康检查

- [x] 4.1 实现 `/api/health` 健康检查端点（含数据库连通性）
- [x] 4.2 实现 `/admin` 口令登录与 httpOnly 签名 Cookie session
- [x] 4.3 实现 `/admin` 空态框架页（供后续 change 填充内容类型）

## 5. 部署链路

- [x] 5.1 配置 `next.config` 输出 standalone 产物
- [x] 5.2 编写 Caddyfile（自动 HTTPS + 反向代理）
- [x] 5.3 编写 pm2 `ecosystem.config.cjs` 与开机自启说明
- [x] 5.4 编写 `scripts/deploy.sh`（传输 → 新版本目录 → 迁移 → 切软链接 → 重启 → 健康检查 → 失败自动回滚）
- [x] 5.5 编写数据库定时备份脚本
- [x] 5.6 配置 GitHub Actions CI（安装依赖 → 类型检查 → 构建）
- [x] 5.7 编写 `DEPLOYMENT.md` 运维文档

## 6. 验证与上线

- [x] 6.1 本地构建与启动验证
- [ ] 6.2 在 Linode 执行首次部署并验证 HTTPS 可访问
- [ ] 6.3 验证 pm2 崩溃重启与开机自启
- [ ] 6.4 验证版本回滚流程

> 6.2–6.4 需在 Linode 服务器上执行，依赖仓库 secrets（`LINODE_HOST` / `LINODE_USER` / `LINODE_SSH_KEY`）与服务器访问权限。
> 本地已完成：lint、typecheck、34 项单元测试、`next build`，以及 standalone 产物冒烟
> （`/api/health` 200、`/` 200、`/admin/login` 200、`/admin` 307 重定向到登录页）。
> 服务器上按 `DEPLOYMENT.md` 即可完成 6.2–6.4。
