// Usage: node scripts/test-email.js <recipient-email>
// Sends one verification email with a dummy token to confirm Resend delivery.
// Standalone check, not used by the app.
require('dotenv').config();
const crypto = require('crypto');
const { sendVerificationEmail } = require('../src/email/email');

const [, , to] = process.argv;

if (!to) {
  console.error('Usage: node scripts/test-email.js <recipient-email>');
  process.exit(1);
}

sendVerificationEmail(to, crypto.randomBytes(32).toString('hex'))
  .then((data) => console.log(`Sent to ${to}. Resend id: ${data.id}`))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
