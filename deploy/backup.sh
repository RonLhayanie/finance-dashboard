#!/usr/bin/env bash
# WAL-safe SQLite backup with 14-day retention.
# Needs the sqlite3 CLI. Defaults match the Railway volume layout in deploy/README.md.
set -euo pipefail

DB_PATH="${DB_PATH:-/data/data.db}"
BACKUP_DIR="${BACKUP_DIR:-/data/backups}"
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
