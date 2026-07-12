const express = require('express');
const db = require('../db/db');
const { verifyPassword } = require('../auth/password');
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

router.get('/me', (req, res) => {
  const token = parseCookies(req)[COOKIE_NAME];
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(session.userId);
  res.json({ username: user ? user.username : null });
});

module.exports = router;
