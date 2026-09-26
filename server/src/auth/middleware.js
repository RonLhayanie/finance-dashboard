const { getSession } = require('./session');

const COOKIE_NAME = 'fable_session';
// Secure only in production: browsers drop Secure cookies on plain-http
// localhost, which would break local dev. Railway must set NODE_ENV=production.
const COOKIE_ATTRS = `HttpOnly; SameSite=Strict; Path=/${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function requireAuth(req, res, next) {
  const token = parseCookies(req)[COOKIE_NAME];
  const session = getSession(token);
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.userId = session.userId;
  req.sessionToken = token;
  next();
}

module.exports = { requireAuth, parseCookies, COOKIE_NAME, COOKIE_ATTRS };
