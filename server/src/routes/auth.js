const express = require('express');
const db = require('../db/db');
const { verifyPassword, hashPassword } = require('../auth/password');
const { createVerificationToken, consumeToken } = require('../db/tokens');
const { sendVerificationEmail } = require('../email/email');
const { createSession, getSession, destroySession } = require('../auth/session');
const { requireAuth, parseCookies, COOKIE_NAME } = require('../auth/middleware');

const router = express.Router();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map();

function isRateLimited(ip) {
  const entry = attempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    attempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(ip) {
  const entry = attempts.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: Date.now() + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function sessionCookie(token) {
  // Secure flag omitted: app is served over the Tailscale interface (HTTP within an
  // encrypted mesh). If Caddy/HTTPS is ever put in front, add '; Secure'.
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`;
}

router.post('/login', (req, res) => {
  const ip = req.ip || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  }

  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    recordFailure(ip);
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  attempts.delete(ip);
  const token = createSession(user.id);
  res.setHeader('Set-Cookie', sessionCookie(token));
  res.json({ ok: true, username: user.username });
});

router.post('/logout', requireAuth, (req, res) => {
  destroySession(req.sessionToken);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
  res.json({ ok: true });
});

const VERIFY_TOKEN_TTL_MINUTES = 24 * 60;

router.post('/signup', async (req, res) => {
  const body = req.body || {};
  const fields = ['email', 'password', 'passwordConfirm', 'firstName', 'username', 'phone'];
  if (fields.some((f) => typeof body[f] !== 'string' || body[f].trim() === '')) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  const { password, passwordConfirm, username } = body;
  const email = body.email.trim().toLowerCase();
  const firstName = body.firstName.trim();
  const phone = body.phone.trim();

  if (password !== passwordConfirm) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
    return res.status(409).json({ error: 'Username is already taken' });
  }
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'Email is already registered' });
  }

  const { userId, token } = db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare(
        'INSERT INTO users (username, password_hash, email, phone, first_name, email_verified) VALUES (?, ?, ?, ?, ?, 0)'
      )
      .run(username, hashPassword(password), email, phone, firstName);
    return {
      userId: lastInsertRowid,
      token: createVerificationToken(lastInsertRowid, 'email_verify', VERIFY_TOKEN_TTL_MINUTES),
    };
  })();

  try {
    await sendVerificationEmail(email, token);
  } catch (err) {
    // No resend-verification flow yet, so a user whose email never arrived
    // would be stuck. Roll back (token row cascades) so they can sign up again.
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    console.error(err);
    return res.status(502).json({ error: 'Could not send verification email. Please try again.' });
  }

  res.status(201).json({ ok: true, message: 'Account created. Check your email to verify your address.' });
});

router.get('/verify-email', (req, res) => {
  const { token } = req.query;
  if (typeof token !== 'string' || !token) {
    return res.status(400).json({ error: 'Invalid or already used verification link' });
  }

  const result = db.transaction(() => {
    const r = consumeToken(token, 'email_verify');
    if (r.userId) db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(r.userId);
    return r;
  })();

  if (result.error === 'expired') {
    return res.status(410).json({ error: 'Verification link has expired' });
  }
  if (result.error) {
    return res.status(400).json({ error: 'Invalid or already used verification link' });
  }
  res.json({ ok: true, message: 'Email verified' });
});

router.get('/me', (req, res) => {
  const token = parseCookies(req)[COOKIE_NAME];
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(session.userId);
  res.json({ username: user ? user.username : null });
});

module.exports = router;
