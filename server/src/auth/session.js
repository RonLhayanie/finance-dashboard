const crypto = require('crypto');

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sessions = new Map();

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function getSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function destroySession(token) {
  sessions.delete(token);
}

// exceptToken keeps the caller's own session (e.g. after changing a password).
function destroyUserSessions(userId, exceptToken) {
  for (const [token, session] of sessions) {
    if (session.userId === userId && token !== exceptToken) sessions.delete(token);
  }
}

// Sessions are in-memory: a server restart logs the user out. Acceptable for a single-user app.
module.exports = { createSession, getSession, destroySession, destroyUserSessions };
