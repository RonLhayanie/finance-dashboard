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
  ['last_name', 'TEXT'],
  ['email_verified', 'INTEGER NOT NULL DEFAULT 0'],
]) {
  if (!userColumns.includes(name)) db.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
}

// ALTER TABLE can't change NOT NULL/UNIQUE, so older databases (username NOT
// NULL UNIQUE, email nullable) get users rebuilt once to match schema.sql.
// Fails and rolls back if any row has no email. Foreign keys must be off to
// drop the table other tables reference; they're checked before committing.
const usersInfo = Object.fromEntries(db.prepare('PRAGMA table_info(users)').all().map((c) => [c.name, c]));
if (usersInfo.username.notnull || !usersInfo.email.notnull) {
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      db.exec(`CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        email TEXT NOT NULL,
        phone TEXT,
        first_name TEXT,
        last_name TEXT,
        email_verified INTEGER NOT NULL DEFAULT 0
      )`);
      db.exec(`INSERT INTO users_new (id, username, password_hash, created_at, email, phone, first_name, last_name, email_verified)
        SELECT id, username, password_hash, created_at, lower(email), phone, first_name, last_name, email_verified FROM users`);
      db.exec('DROP TABLE users');
      db.exec('ALTER TABLE users_new RENAME TO users');
      const violations = db.pragma('foreign_key_check');
      if (violations.length) throw new Error(`users rebuild left ${violations.length} foreign key violations`);
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

// Here, not in schema.sql: on an older DB the email column doesn't exist yet
// when schema.sql runs. NOCASE so uniqueness holds even if a write ever skips
// the lowercasing every route does.
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email COLLATE NOCASE)');

module.exports = db;
