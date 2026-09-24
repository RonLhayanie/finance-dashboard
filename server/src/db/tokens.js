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

// Returns the row for an unexpired token of this type, or undefined.
function findValidToken(token, type) {
  return db
    .prepare(
      "SELECT id, user_id, type, expires_at FROM verification_tokens WHERE token = ? AND type = ? AND expires_at > datetime('now')"
    )
    .get(hashToken(token), type);
}

module.exports = { createVerificationToken, findValidToken };
