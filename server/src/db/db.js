const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || './data.db';
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// schema.sql only creates missing tables; columns added to an existing table
// are applied here. Idempotent, runs on every startup.
const userColumns = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
for (const [name, definition] of [
  ['email', 'TEXT'],
  ['phone', 'TEXT'],
  ['first_name', 'TEXT'],
  ['email_verified', 'INTEGER NOT NULL DEFAULT 0'],
]) {
  if (!userColumns.includes(name)) db.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
}
// Here, not in schema.sql: on an existing DB the email column doesn't exist
// yet when schema.sql runs.
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)');

module.exports = db;
