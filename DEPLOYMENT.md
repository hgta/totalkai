# totalk.ai 部署与运维

目标环境：Linode 2GB 实例，Ubuntu。应用以 standalone 产物运行，pm2 守护，Caddy 提供 HTTPS。
**构建不在服务器上执行**——构建只发生在 GitHub Actions 或本地，服务器只运行产物。

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
└── ecosystem.config.cjs              pm2 配置（首次部署时放置，不随版本变动）
```

## 服务器前置条件

```bash
# Node 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# pm2
sudo npm install -g pm2

# Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# sqlite3（备份脚本用，缺失时自动退化为文件拷贝）
sudo apt install -y sqlite3
```

## 首次部署

1. 创建目录

```bash
sudo mkdir -p /var/www/totalkai/{releases,incoming,data,backups,scripts}
sudo chown -R "$USER":"$USER" /var/www/totalkai
```

2. 放置 pm2 配置与环境变量

```bash
cp ecosystem.config.cjs /var/www/totalkai/ecosystem.config.cjs
cp .env.example /var/www/totalkai/data/.env   # 按实际值填写后使用
```

环境变量清单（`data/.env`）：`DATABASE_PATH`、`SITE_URL`、`ADMIN_PASSWORD`、`SESSION_SECRET`、`PORT`。
缺失任一项，应用会在启动期直接失败，不会静默降级。

3. 配置 Caddy

```bash
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

域名 `totalk.ai` 需已解析到本实例 IP，Caddy 会自动签发并续期证书。

4. 配置仓库 secrets

在 GitHub 仓库 Settings → Secrets 中添加：`LINODE_HOST`、`LINODE_USER`、`LINODE_SSH_KEY`。

5. 触发部署

推送到 `main` 分支即触发 `.github/workflows/deploy.yml`：先跑 lint / typecheck / test / build，
全部通过后打包 standalone 产物上传并执行 `deploy.sh`。

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
sudo ln -sfn /var/www/totalkai/releases/<上一版本> /var/www/totalkai/current
pm2 restart totalkai
curl -i http://127.0.0.1:3000/api/health
```

## 进程守护与开机自启

```bash
pm2 start /var/www/totalkai/ecosystem.config.cjs
pm2 save
pm2 startup        # 按输出提示执行生成的命令
```

2GB 机器使用 `exec_mode: fork` 单实例，不启用 cluster。

### systemd 备选（pm2 不可用时）

创建 `/etc/systemd/system/totalkai.service`：

```ini
[Unit]
Description=totalk.ai
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/totalkai/current
EnvironmentFile=/var/www/totalkai/data/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now totalkai
```

## 数据库备份

```bash
chmod +x /var/www/totalkai/scripts/backup-db.sh
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

## 已接受风险

`next` 内嵌的 `postcss` 存在上游高危告警（GHSA-qx2v-qp2m-jg93 等），
修复需升级到 Next 16（破坏性大版本）。该 postcss 仅在构建期处理本项目自编的 CSS，
不处理不可信输入，运行时无暴露面。待后续大版本升级时消除。
