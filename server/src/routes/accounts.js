const express = require('express');
const { SCRAPERS } = require('israeli-bank-scrapers');
const db = require('../db/db');
const vault = require('../crypto/vault');
const { PROVIDER_TO_COMPANY } = require('../sync/scraper');
const { startSync } = require('../sync/engine');

const router = express.Router();

router.get('/', (req, res) => {
  const accounts = db
    .prepare('SELECT id, provider, display_name, last_sync_at, created_at FROM accounts WHERE user_id = ? ORDER BY id')
    .all(req.userId);
  res.json(accounts);
});

router.post('/', (req, res) => {
  const { provider, displayName, credentials } = req.body || {};

  const companyId = PROVIDER_TO_COMPANY[provider];
  if (!companyId) {
    return res.status(400).json({ error: `provider must be one of: ${Object.keys(PROVIDER_TO_COMPANY).join(', ')}` });
  }
  if (typeof displayName !== 'string' || displayName.trim().length === 0) {
    return res.status(400).json({ error: 'displayName is required' });
  }
  if (typeof credentials !== 'object' || credentials === null) {
    return res.status(400).json({ error: 'credentials is required' });
  }

  const requiredFields = SCRAPERS[companyId].loginFields;
  for (const field of requiredFields) {
    if (typeof credentials[field] !== 'string' || credentials[field].length === 0) {
      return res.status(400).json({ error: `credentials.${field} is required` });
    }
  }

  const { encrypted, iv, tag } = vault.encrypt(JSON.stringify(credentials));

  const insert = db
    .prepare(
      `INSERT INTO accounts (user_id, provider, display_name, credentials_encrypted, credentials_iv, credentials_tag)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(req.userId, provider, displayName.trim(), encrypted, iv, tag);

  const account = db
    .prepare('SELECT id, provider, display_name, last_sync_at, created_at FROM accounts WHERE id = ? AND user_id = ?')
    .get(insert.lastInsertRowid, req.userId);

  // Fire-and-forget: the first sync doubles as the connection validation. If
  // it can't even be started (e.g. a job is somehow already active for this
  // brand-new account), don't fail account creation - the user can still
  // trigger a sync manually from the UI.
  try {
    startSync(account.id);
  } catch (err) {
    // intentionally ignored - see comment above
  }

  res.status(201).json(account);
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(404).json({ error: `Account not found: ${req.params.id}` });
  }

  // Ownership check first: an account that exists but belongs to another
  // user must 404 exactly like one that doesn't exist at all - never 403,
  // which would confirm the id is in use by someone else.
  const account = db.prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?').get(id, req.userId);
  if (!account) {
    return res.status(404).json({ error: `Account not found: ${id}` });
  }

  db.prepare('DELETE FROM accounts WHERE id = ? AND user_id = ?').run(id, req.userId);
  res.json({ ok: true });
});

module.exports = router;
