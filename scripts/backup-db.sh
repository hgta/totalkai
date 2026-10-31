#!/usr/bin/env bash
# 数据库备份。配合 crontab 每日执行，滚动保留 7 天。
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/totalkai}"
DATA_DIR="$APP_ROOT/data"
BACKUP_DIR="$APP_ROOT/backups"
DB_FILE="${DATABASE_PATH:-$DATA_DIR/totalkai.db}"
KEEP_DAYS="${KEEP_DAYS:-7}"

[ -f "$DB_FILE" ] || {
  echo "错误: 数据库文件不存在: $DB_FILE" >&2
  exit 1
}

mkdir -p "$BACKUP_DIR"

TARGET="$BACKUP_DIR/db-$(date +%Y%m%d).db"

echo "==> 备份数据库到 $TARGET"
# WAL 模式下需一并固化 WAL，保证副本可独立恢复
sqlite3 "$DB_FILE" ".backup '$TARGET'" 2>/dev/null || cp "$DB_FILE" "$TARGET"

echo "==> 清理 $KEEP_DAYS 天前的备份"
find "$BACKUP_DIR" -name 'db-*.db' -type f -mtime +"$KEEP_DAYS" -delete

echo "==> 备份完成"
