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

- **WHEN** 每日备份任务触发
- **THEN** 备份目录生成当日数据库副本

#### Scenario: 备份超过保留期

- **WHEN** 备份目录中存在超过 7 天的备份文件
- **THEN** 超过保留期的备份被清理

### Requirement: 管理后台访问控制

系统 SHALL 要求 `/admin` 下的所有页面在登录后访问，未登录请求跳转到登录页；会话使用 httpOnly 签名 Cookie。

#### Scenario: 未登录访问后台

- **WHEN** 未携带有效会话 Cookie 的请求访问 `/admin`
- **THEN** 请求被重定向到登录页

#### Scenario: 口令错误

- **WHEN** 提交错误的口令
- **THEN** 登录失败且不签发会话 Cookie

#### Scenario: 口令正确

- **WHEN** 提交正确的口令
- **THEN** 系统签发 httpOnly 签名 Cookie 且请求可访问 `/admin`
