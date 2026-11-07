# totalk.ai 部署与运维

目标环境：Linode 2GB 实例，**Rocky Linux 9**。**Nginx 与 HTTPS 证书统一由宝塔面板管理**，
以便同一台机器托管其他站点与数据库。应用以 standalone 产物运行，pm2 守护。

**构建不在服务器上执行**——构建只发生在 GitHub Actions 或本地，服务器只运行产物。

> **为什么选 Rocky 9 而不是 Ubuntu**：宝塔起家于 CentOS 系，对 RHEL 系（Rocky/Alma）的支持最成熟；
> 且 Rocky 9 支持到 2032 年。代价是 RHEL 系自带的 SELinux 与 firewalld 需要各多执行一条命令（见下文）。

## 架构与端口

```
公网请求
   │
   ▼
Linode 云防火墙（仅放行 22 / 80 / 443）
   │
   ▼
宝塔 Nginx  :80  ──强制跳转──▶  :443（Let's Encrypt 证书，宝塔自动续期）
   │
   │   proxy_pass
   ▼
127.0.0.1:3000   Next.js standalone（node server.js，pm2 守护）
   │
   ▼
SQLite  /var/www/totalkai/data/totalkai.db
```

**3000 端口不对外暴露**，只有本机 Nginx 能访问。云防火墙里**不要**放行 3000。

## 目录结构

```
/var/www/totalkai/
├── current -> releases/<timestamp>   软链接，指向当前生效版本
├── releases/                         各次部署的版本目录（保留最近 5 个）
├── incoming/                         CI 上传的产物与脚本暂存目录
├── data/                             持久化数据（数据库文件），不随版本变动
├── backups/                          数据库每日备份（保留 7 天）
├── scripts/deploy.sh                 部署脚本
├── scripts/backup-db.sh              备份脚本
└── ecosystem.config.cjs              pm2 配置（首次部署时放置）
```

> 数据库放在 `data/` 而非版本目录内，是回滚安全的前提：切换版本时数据不受影响。

## 服务器前置条件

### ① 装 Node 20

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs
node -v        # v20.x
```

### ② 装 pm2 与 sqlite

```bash
npm install -g pm2
dnf install -y sqlite
```

> **注意**：RHEL 系的软件包名是 `sqlite`（装出来的是 `sqlite3` 命令），不是 `sqlite3`。

### ③ 装宝塔面板

```bash
url=https://download.bt.cn/install/install_lts.sh
if [ -f /usr/bin/curl ]; then curl -sSL $url -o install.sh; else wget -O install.sh $url; fi
bash install.sh ed8484bec
```

装完会打印**面板地址、用户名、密码**，务必保存。首次登录后在「软件商店」里安装 **Nginx**。

> **重要**：宝塔自带 Nginx 会占用 80/443，**不要**再安装 Caddy，两者端口冲突。
> 本仓库已移除 `Caddyfile`。

### ④ 防火墙端口（两层）

**Linode 云防火墙**放行：`22`（SSH）、`80`（HTTP）、`443`（HTTPS）。

**系统内 firewalld**（Rocky 9 默认只放行 SSH，必须手动加）：

```bash
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
firewall-cmd --list-all     # 确认输出里有 http https
```

### ⑤ SELinux 放行反向代理（Rocky 特有，必做）

```bash
getenforce                  # 确认是 Enforcing
setsebool -P httpd_can_network_connect 1
```

不做这一步的典型症状：Nginx 正常启动、证书也签好了，但页面 502。

宝塔面板自身的端口（默认 `8888`）**建议只在云防火墙里对你的 IP 放行**，
不要对全网开放——面板是常见的攻击入口。

## 首次部署

**1. 建目录**

```bash
mkdir -p /var/www/totalkai/{releases,incoming,data,backups,scripts}
```

**2. 放配置文件**

```bash
cp ecosystem.config.cjs    /var/www/totalkai/ecosystem.config.cjs
cp scripts/deploy.sh       /var/www/totalkai/scripts/deploy.sh
cp scripts/backup-db.sh    /var/www/totalkai/scripts/backup-db.sh
chmod +x /var/www/totalkai/scripts/*.sh
```

**3. 写环境变量（最关键的目录设置）**

```bash
cat > /var/www/totalkai/data/.env << 'EOF'
DATABASE_PATH=/var/www/totalkai/data/totalkai.db
SITE_URL=https://totalk.ai
ADMIN_PASSWORD=改成你的管理员口令
SESSION_SECRET=改成一段足够长的随机字符串
PORT=3000
EOF
chmod 600 /var/www/totalkai/data/.env
```

环境变量说明：

| 变量 | 作用 | 注意 |
|---|---|---|
| `DATABASE_PATH` | SQLite 文件位置 | 必须在 `data/` 下，不能放版本目录内 |
| `SITE_URL` | 生成 sitemap 与 OG 链接 | 带 `https://`，结尾不带斜杠 |
| `ADMIN_PASSWORD` | `/admin` 登录口令 | 用足够长的随机串 |
| `SESSION_SECRET` | 会话 Cookie 签名密钥 | 随机串，更换它会让已登录会话失效 |
| `PORT` | 应用监听端口 | 保持 3000，与 Nginx 反代一致 |

缺失任一项，应用会在启动期直接失败，不会静默降级。

**4. 在宝塔里建反向代理站点**

```
网站 → 添加站点
  · 域名：totalk.ai
  · 类型：纯静态
  · 根目录：/www/wwwroot/totalk.ai（保持默认，实际不使用）
```

然后：

```
站点设置 → 反向代理 → 添加反向代理
  · 代理名称：totalkai
  · 目标 URL：http://127.0.0.1:3000
  · 发送域名：$host
```

接着把仓库里的 `scripts/nginx-reverse-proxy.conf` 内容，替换进：

```
站点设置 → 配置文件 → location / 这一段
```

保存，宝塔会自动重载 Nginx。

> 那个配置文件里 `X-Forwarded-Proto $scheme` 是必须的。缺了它，Next.js 会以为请求是 http，
> 生成的链接和登录跳转都会出错。

**5. 申请 HTTPS 证书**

```
站点设置 → SSL → Let's Encrypt → 申请
  · 勾选 totalk.ai（如需 www 一并勾选）
  · 申请后开启「强制 HTTPS」
```

宝塔会自动续期，不用手动管。

**6. 配置 CI secrets**

GitHub 仓库 Settings → Secrets and variables → Actions，添加：

| Secret | 值 |
|---|---|
| `LINODE_HOST` | 服务器 IP |
| `LINODE_USER` | `root` |
| `LINODE_SSH_KEY` | 你生成的**私钥**全文（`id_ed25519_totalkai`，不是 `.pub`） |

私钥在本机这样复制：

```powershell
Get-Content "$env:USERPROFILE\.ssh\id_ed25519_totalkai" -Raw | clip
```

**7. 推送 main 触发部署**

推送到 `main` 即触发 `.github/workflows/deploy.yml`：
先跑 lint / typecheck / test / build，全部通过后打包上传并执行 `deploy.sh`。

## 部署流程说明

`scripts/deploy.sh` 依次执行：

1. 解压产物到 `releases/<timestamp>`
2. 校验产物含 `server.js` 与 `drizzle/` 迁移目录
3. 软链接 `current` 指向新版本
4. `pm2 restart`（首次则 `pm2 start`）
5. 轮询 `/api/health`，最多 30 次、间隔 2 秒
6. **失败则软链接回退上一版本并重启，以非 0 退出**
7. 成功则 `pm2 save`，并清理旧版本保留最近 5 个

数据库迁移在应用启动时由 `instrumentation.ts` 执行，迁移幂等。
迁移失败会让进程退出，进而被健康检查捕获并触发回滚。

## 回滚

回滚即把软链接指回上一版本并重启，无需重新构建：

```bash
ls -1dt /var/www/totalkai/releases/*/    # 查看可用版本
ln -sfn /var/www/totalkai/releases/<上一版本> /var/www/totalkai/current
pm2 restart totalkai
curl -i http://127.0.0.1:3000/api/health
```

## 进程守护与开机自启

```bash
pm2 start /var/www/totalkai/ecosystem.config.cjs
pm2 save
pm2 startup        # 按输出提示执行生成的命令
```

2GB 机器使用 `exec_mode: fork` 单实例，不启用 cluster
（SQLite 单写者模型下，多进程反而会引起写锁竞争）。

### systemd 备选（pm2 不可用时）

创建 `/etc/systemd/system/totalkai.service`：

```ini
[Unit]
Description=totalk.ai
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/totalkai/current
EnvironmentFile=/var/www/totalkai/data/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now totalkai
```

## 数据库备份

```bash
crontab -e
# 每日 03:00 备份
0 3 * * * /var/www/totalkai/scripts/backup-db.sh >> /var/www/totalkai/backups/backup.log 2>&1
```

恢复：

```bash
pm2 stop totalkai
cp /var/www/totalkai/backups/db-<日期>.db /var/www/totalkai/data/totalkai.db
pm2 start totalkai
```

## 健康检查

```bash
curl -i https://totalk.ai/api/health
# 正常: 200 {"status":"ok","database":"ok","timestamp":...}
# 数据库不可用: 503 {"status":"error","database":"error",...}
```

## 宝塔相关注意事项

- **不要装 Caddy**。宝塔的 Nginx 已占用 80/443，Caddy 会启动失败。
- **面板端口（默认 8888）尽量限制来源 IP**，别对全网开放。
- 宝塔的「防跨站攻击」「PHP 设置」等选项对 Node 应用无效，可以忽略。
- 每次新增站点时，确认新站点没有占用 3000 端口——那是我们应用的端口。
- 宝塔会定期提示更新，建议开启自动更新（含安全补丁）。

## 已接受风险

`next` 内嵌的 `postcss` 存在上游高危告警（GHSA-qx2v-qp2m-jg93 等），
修复需升级到 Next 16（破坏性大版本）。该 postcss 仅在构建期处理本项目自编的 CSS，
不处理不可信输入，运行时无暴露面。待后续大版本升级时消除。
