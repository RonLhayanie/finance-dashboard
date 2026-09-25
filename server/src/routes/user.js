const express = require('express');
const db = require('../db/db');
const { verifyPassword, hashPassword } = require('../auth/password');
const { destroyUserSessions } = require('../auth/session');
const { COOKIE_NAME } = require('../auth/middleware');
const { createVerificationToken, deleteTokens } = require('../db/tokens');
const { sendVerificationEmail } = require('../email/email');
const { get_subscriptions } = require('../ai/tools');

const router = express.Router();

const VERIFY_TOKEN_TTL_MINUTES = 24 * 60;

function getProfile(userId) {
  return db.prepare('SELECT first_name, username, email, phone FROM users WHERE id = ?').get(userId);
}

// Wrong password is 403, not 401: the client treats any 401 as an expired
// session and redirects to /login.
function checkCurrentPassword(userId, currentPassword) {
  if (typeof currentPassword !== 'string' || !currentPassword) {
    return { status: 400, error: 'Current password is required' };
  }
  const { password_hash } = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
  if (!verifyPassword(currentPassword, password_hash)) {
    return { status: 403, error: 'Current password is incorrect' };
  }
  return null;
}

router.get('/profile', (req, res) => {
  res.json(getProfile(req.userId));
});

router.put('/profile', async (req, res) => {
  const body = req.body || {};
  const current = getProfile(req.userId);
  const updates = {};

  for (const field of ['first_name', 'phone']) {
    if (body[field] === undefined) continue;
    if (typeof body[field] !== 'string' || !body[field].trim()) {
      return res.status(400).json({ error: `${field} cannot be empty` });
    }
    updates[field] = body[field].trim();
  }

  let newEmail = null;
  if (body.email !== undefined) {
    if (typeof body.email !== 'string' || !body.email.trim()) {
      return res.status(400).json({ error: 'email cannot be empty' });
    }
    const email = body.email.trim().toLowerCase();
    if (email !== current.email) newEmail = email;
  }

  const { newPassword, newPasswordConfirm } = body;
  const changingPassword = newPassword !== undefined && newPassword !== '';

  if (newEmail || changingPassword) {
    const failure = checkCurrentPassword(req.userId, body.currentPassword);
    if (failure) return res.status(failure.status).json({ error: failure.error });
  }
  if (changingPassword) {
    if (typeof newPassword !== 'string' || newPassword !== newPasswordConfirm) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
  }
  if (newEmail && db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(newEmail, req.userId)) {
    return res.status(409).json({ error: 'Email is already registered' });
  }

  // All validation is done; apply every change together.
  const token = db.transaction(() => {
    for (const [field, value] of Object.entries(updates)) {
      db.prepare(`UPDATE users SET ${field} = ? WHERE id = ?`).run(value, req.userId);
    }
    if (changingPassword) {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), req.userId);
    }
    if (!newEmail) return null;
    db.prepare('UPDATE users SET email = ?, email_verified = 0 WHERE id = ?').run(newEmail, req.userId);
    deleteTokens(req.userId, 'email_verify');
    return createVerificationToken(req.userId, 'email_verify', VERIFY_TOKEN_TTL_MINUTES);
  })();

  const response = { ok: true, profile: getProfile(req.userId) };
  if (token) {
    response.emailSent = true;
    try {
      await sendVerificationEmail(newEmail, token);
    } catch (err) {
      console.error(err);
      response.emailSent = false;
    }
    response.message = 'Email updated. Verify the new address before your next login.';
  }
  res.json(response);
});

router.get('/export', (req, res) => {
  const userId = req.userId;
  const data = {
    exported_at: new Date().toISOString(),
    profile: getProfile(userId),
    // Same columns as GET /api/accounts: never the encrypted credentials.
    accounts: db
      .prepare('SELECT id, provider, display_name, last_sync_at, created_at FROM accounts WHERE user_id = ? ORDER BY id')
      .all(userId),
    // Full history, unlike the paginated/filtered transaction endpoints.
    transactions: db
      .prepare(
        `SELECT id, account_id, date, amount, currency, description, category, is_anomaly
         FROM transactions
         WHERE account_id IN (SELECT id FROM accounts WHERE user_id = ?)
         ORDER BY date DESC, id DESC`
      )
      .all(userId),
    subscriptions: get_subscriptions({ userId }),
  };
  const date = data.exported_at.slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="ledgerly-export-${date}.json"`);
  res.json(data);
});

router.delete('/account', (req, res) => {
  const failure = checkCurrentPassword(req.userId, (req.body || {}).currentPassword);
  if (failure) return res.status(failure.status).json({ error: failure.error });

  // schema.sql declares ON DELETE CASCADE from users to accounts/insights, but
  // databases created before that have NO ACTION on those two FKs (CREATE TABLE
  // IF NOT EXISTS never alters), so delete them explicitly. transactions,
  // subscriptions and sync_jobs cascade from accounts; tokens from users.
  db.transaction(() => {
    db.prepare('DELETE FROM accounts WHERE user_id = ?').run(req.userId);
    db.prepare('DELETE FROM insights WHERE user_id = ?').run(req.userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.userId);
  })();
  destroyUserSessions(req.userId);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
  res.json({ ok: true });
});

module.exports = router;
