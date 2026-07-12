#!/usr/bin/env bash
# WAL-safe SQLite backup with 14-day retention.
# Cron (as the fable user):  15 3 * * * /opt/fable/deploy/backup.sh >> /opt/fable/backups/backup.log 2>&1
set -euo pipefail

DB_PATH="${DB_PATH:-/opt/fable/data/data.db}"
BACKUP_DIR="${BACKUP_DIR:-/opt/fable/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "$(date -Is) ERROR: database not found at $DB_PATH"
  exit 1
fi

STAMP="$(date +%F)"
TARGET="$BACKUP_DIR/data-$STAMP.db"

# .backup takes a consistent snapshot even while the app is writing (WAL mode).
sqlite3 "$DB_PATH" ".backup '$TARGET'"

find "$BACKUP_DIR" -name 'data-*.db' -mtime +"$RETENTION_DAYS" -delete

echo "$(date -Is) OK: backed up to $TARGET"
