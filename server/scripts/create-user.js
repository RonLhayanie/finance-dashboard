// Usage: node scripts/create-user.js <username> <password>
// Creates or updates the dashboard user. Run once during deployment.
require('dotenv').config();
const db = require('../src/db/db');
const { hashPassword } = require('../src/auth/password');

const [, , username, password] = process.argv;

if (!username || !password) {
  console.error('Usage: node scripts/create-user.js <username> <password>');
  process.exit(1);
}
if (password.length < 10) {
  console.error('Password must be at least 10 characters.');
  process.exit(1);
}

const hash = hashPassword(password);
const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

if (existing) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, existing.id);
  console.log(`Updated password for user "${username}".`);
} else {
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
  console.log(`Created user "${username}".`);
}
