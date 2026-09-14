CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  credentials_encrypted TEXT NOT NULL,
  credentials_iv TEXT NOT NULL,
  credentials_tag TEXT NOT NULL,
  last_sync_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ILS',
  description TEXT NOT NULL,
  category TEXT,
  is_anomaly INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, external_id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  merchant TEXT NOT NULL,
  amount REAL NOT NULL,
  frequency TEXT NOT NULL,
  last_charged TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  detected_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('RUNNING','NEEDS_OTP','DONE','FAILED')),
  otp_code TEXT,
  error TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS card_mappings (
  last4      TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS merchant_categories (
  merchant TEXT PRIMARY KEY,
  category TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS category_labels (
  slug TEXT PRIMARY KEY,
  label_he TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS insights (
  id INTEGER PRIMARY KEY,
  text TEXT NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_account_merchant ON subscriptions(account_id, merchant);

INSERT OR IGNORE INTO card_mappings (last4, account_id) VALUES ('0659', 17);

INSERT OR IGNORE INTO category_labels (slug, label_he) VALUES
  ('groceries', 'מכולת'),
  ('restaurants', 'מסעדות'),
  ('transport', 'תחבורה'),
  ('fuel', 'דלק'),
  ('utilities', 'חשבונות'),
  ('telecom', 'תקשורת'),
  ('insurance', 'ביטוח'),
  ('health', 'בריאות'),
  ('entertainment', 'בידור'),
  ('shopping', 'קניות'),
  ('subscriptions', 'מנויים'),
  ('salary', 'משכורת'),
  ('transfers', 'העברות'),
  ('fees', 'עמלות'),
  ('cash', 'מזומן'),
  ('card_payment', 'תשלום כרטיס'),
  ('internal', 'תנועה פנימית'),
  ('other', 'אחר');
