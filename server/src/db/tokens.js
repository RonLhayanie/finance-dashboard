const crypto = require('crypto');
const db = require('./db');

// Only the SHA-256 of a token is ever stored. The raw token exists only in the
// emailed link. Lookups hash the incoming token and match on the hash - never
// compare or store raw values.
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// Returns the raw token for the email link; the DB gets the hash.
function createVerificationToken(userId, type, ttlMinutes) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(
    "INSERT INTO verification_tokens (user_id, token, type, expires_at) VALUES (?, ?, ?, datetime('now', ?))"
  ).run(userId, hashToken(token), type, `+${ttlMinutes} minutes`);
  return token;
}

// Single use: a valid token is deleted on consumption (same for every type).
// Expired rows are left in place so a repeat click still reports "expired".
// Returns { userId } | { error: 'invalid' } | { error: 'expired' }.
function consumeToken(token, type) {
  const row = db
    .prepare(
      "SELECT id, user_id, expires_at <= datetime('now') AS expired FROM verification_tokens WHERE token = ? AND type = ?"
    )
    .get(hashToken(token), type);
  if (!row) return { error: 'invalid' };
  if (row.expired) return { error: 'expired' };
  db.prepare('DELETE FROM verification_tokens WHERE id = ?').run(row.id);
  return { userId: row.user_id };
}

module.exports = { createVerificationToken, consumeToken };
