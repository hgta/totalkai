#!/usr/bin/env bash
# 应用部署脚本。在 Linode 服务器上执行，不负责构建（构建在 CI 完成）。
#
# 流程：解压新版本 → 校验产物 → 切换软链接 → 重启服务 → 健康检查 → 失败回滚 → 清理旧版本
# 数据库迁移由应用启动时（instrumentation.ts）执行，迁移失败会导致健康检查失败并触发回滚。
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/totalkai}"
RELEASES_DIR="$APP_ROOT/releases"
DATA_DIR="$APP_ROOT/data"
INCOMING_DIR="$APP_ROOT/incoming"
CURRENT="$APP_ROOT/current"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
HEALTH_RETRIES="${HEALTH_RETRIES:-30}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-2}"
TARBALL="$INCOMING_DIR/release.tar.gz"

fail() {
  echo "错误: $*" >&2
  exit 1
}

[ -d "$APP_ROOT" ] || fail "$APP_ROOT 不存在，请先完成首次部署准备"
[ -f "$APP_ROOT/ecosystem.config.cjs" ] || fail "缺少 $APP_ROOT/ecosystem.config.cjs"
[ -f "$TARBALL" ] || fail "缺少待部署产物 $TARBALL"

TIMESTAMP="$(date +%Y%m%d%H%M%S)"
NEW_RELEASE="$RELEASES_DIR/$TIMESTAMP"

echo "==> 解压新版本到 $NEW_RELEASE"
mkdir -p "$RELEASES_DIR" "$DATA_DIR"
tar -xzf "$TARBALL" -C "$NEW_RELEASE" 2>/dev/null || {
  mkdir -p "$NEW_RELEASE"
  tar -xzf "$TARBALL" -C "$NEW_RELEASE"
}
rm -f "$TARBALL"

echo "==> 校验产物完整性"
[ -f "$NEW_RELEASE/server.js" ] || fail "产物缺少 server.js"
[ -d "$NEW_RELEASE/drizzle" ] || fail "产物缺少 drizzle 迁移目录"

PREVIOUS=""
if [ -L "$CURRENT" ]; then
  PREVIOUS="$(readlink -f "$CURRENT" || true)"
fi

echo "==> 切换软链接到新版本"
ln -sfn "$NEW_RELEASE" "$CURRENT"

echo "==> 重启服务"
if pm2 describe totalkai >/dev/null 2>&1; then
  pm2 restart totalkai --update-env || fail "pm2 restart 失败"
else
  pm2 start "$APP_ROOT/ecosystem.config.cjs" || fail "pm2 start 失败"
fi

echo "==> 健康检查（最多 ${HEALTH_RETRIES} 次，间隔 ${HEALTH_INTERVAL}s）"
healthy=0
for _ in $(seq 1 "$HEALTH_RETRIES"); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || true)"
  if [ "$code" = "200" ]; then
    healthy=1
    break
  fi
  sleep "$HEALTH_INTERVAL"
done

if [ "$healthy" -ne 1 ]; then
  echo "健康检查失败" >&2
  if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    echo "==> 回滚到 $PREVIOUS" >&2
    ln -sfn "$PREVIOUS" "$CURRENT"
    pm2 restart totalkai --update-env || true
  fi
  exit 1
fi

echo "==> 保存 pm2 进程列表（用于开机自启）"
pm2 save || true

echo "==> 清理旧版本（保留最近 $KEEP_RELEASES 个）"
cd "$RELEASES_DIR"
ls -1dt */ 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf

echo "==> 部署完成: $NEW_RELEASE"
