// Usage: node scripts/create-user.js <email> <password> [username]
// Creates a user, or updates the password of the user with that email.
// Run from the server itself, so the address is trusted and marked verified.
require('dotenv').config();
const db = require('../src/db/db');
const { hashPassword } = require('../src/auth/password');

const [, , rawEmail, password, username] = process.argv;

if (!rawEmail || !password) {
  console.error('Usage: node scripts/create-user.js <email> <password> [username]');
  process.exit(1);
}
if (password.length < 10) {
  console.error('Password must be at least 10 characters.');
  process.exit(1);
}

const email = rawEmail.trim().toLowerCase();
const hash = hashPassword(password);
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

if (existing) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, existing.id);
  console.log(`Updated password for user "${email}".`);
} else {
  db.prepare('INSERT INTO users (username, password_hash, email, email_verified) VALUES (?, ?, ?, 1)').run(
    username || null,
    hash,
    email
  );
  console.log(`Created user "${email}".`);
}
