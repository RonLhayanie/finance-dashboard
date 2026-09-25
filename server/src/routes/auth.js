const express = require('express');
const db = require('../db/db');
const { verifyPassword, hashPassword } = require('../auth/password');
const { createVerificationToken, consumeToken, deleteTokens } = require('../db/tokens');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../email/email');
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

// Per-IP cap on every request to one endpoint (each call gets its own Map),
// on top of login's failed-attempt lockout above.
// In-memory and per-process; an expired entry is only replaced when that IP
// returns. Fine for a single instance on Tailscale; needs a shared store if
// this ever runs as multiple processes.
const REQUEST_LIMIT = 10;
function limitRequests() {
  const hits = new Map();
  return (req, res, next) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    let entry = hits.get(ip);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + WINDOW_MS };
      hits.set(ip, entry);
    }
    entry.count += 1;
    if (entry.count > REQUEST_LIMIT) {
      return res.status(429).json({ error: 'Too many attempts, please try again later.' });
    }
    next();
  };
}

function sessionCookie(token) {
  // Secure flag omitted: app is served over the Tailscale interface (HTTP within an
  // encrypted mesh). If Caddy/HTTPS is ever put in front, add '; Secure'.
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`;
}

router.post('/login', limitRequests(), (req, res) => {
  const ip = req.ip || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  }

  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db
    .prepare('SELECT id, username, password_hash, email, email_verified FROM users WHERE email = ?')
    .get(email.trim().toLowerCase());
  if (!user || !verifyPassword(password, user.password_hash)) {
    recordFailure(ip);
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  attempts.delete(ip);
  if (!user.email_verified) {
    // The login page's resend button uses this stored (normalized) email.
    return res.status(403).json({ error: 'Please verify your email before logging in', email: user.email });
  }
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

router.post('/signup', limitRequests(), async (req, res) => {
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

  const token = db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare(
        'INSERT INTO users (username, password_hash, email, phone, first_name, email_verified) VALUES (?, ?, ?, ?, ?, 0)'
      )
      .run(username, hashPassword(password), email, phone, firstName);
    return createVerificationToken(lastInsertRowid, 'email_verify', VERIFY_TOKEN_TTL_MINUTES);
  })();

  try {
    await sendVerificationEmail(email, token);
  } catch (err) {
    // Account stays; the user can request a new link via resend-verification.
    console.error(err);
    return res.status(201).json({
      ok: true,
      emailSent: false,
      message: 'Account created, but the verification email may not have arrived. Use "resend verification email" to get a new link.',
    });
  }

  res.status(201).json({ ok: true, emailSent: true, message: 'Account created. Check your email to verify your address.' });
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

const RESEND_MESSAGE = 'If that email belongs to an unverified account, a new verification link has been sent.';

router.post('/resend-verification', limitRequests(), (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const user = db
    .prepare('SELECT id, email FROM users WHERE email = ? AND email_verified = 0')
    .get(email.trim().toLowerCase());
  if (user) {
    const token = db.transaction(() => {
      deleteTokens(user.id, 'email_verify');
      return createVerificationToken(user.id, 'email_verify', VERIFY_TOKEN_TTL_MINUTES);
    })();
    // Not awaited: the response must look the same (content and timing)
    // whether or not the email exists, so a send failure is only logged.
    sendVerificationEmail(user.email, token).catch((err) => console.error(err));
  }

  res.json({ ok: true, message: RESEND_MESSAGE });
});

const RESET_TOKEN_TTL_MINUTES = 60;
const FORGOT_MESSAGE = 'If that email is registered, a password reset link has been sent.';

router.post('/forgot-password', limitRequests(), (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (user) {
    const token = db.transaction(() => {
      deleteTokens(user.id, 'password_reset');
      return createVerificationToken(user.id, 'password_reset', RESET_TOKEN_TTL_MINUTES);
    })();
    // Not awaited, same reason as resend-verification: identical response either way.
    sendPasswordResetEmail(user.email, token).catch((err) => console.error(err));
  }

  res.json({ ok: true, message: FORGOT_MESSAGE });
});

router.post('/reset-password', limitRequests(), (req, res) => {
  const { token, newPassword, newPasswordConfirm } = req.body || {};
  if ([token, newPassword, newPasswordConfirm].some((v) => typeof v !== 'string' || !v)) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  // Validate before consuming so a typo doesn't burn the token.
  if (newPassword !== newPasswordConfirm) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const result = db.transaction(() => {
    const r = consumeToken(token, 'password_reset');
    if (r.userId) {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), r.userId);
      deleteTokens(r.userId, 'password_reset');
    }
    return r;
  })();

  if (result.error === 'expired') {
    return res.status(410).json({ error: 'Reset link has expired' });
  }
  if (result.error) {
    return res.status(400).json({ error: 'Invalid or already used reset link' });
  }
  res.json({ ok: true, message: 'Password updated. You can now log in.' });
});

router.get('/me', (req, res) => {
  const token = parseCookies(req)[COOKIE_NAME];
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(session.userId);
  res.json({ username: user ? user.username : null });
});

module.exports = router;
