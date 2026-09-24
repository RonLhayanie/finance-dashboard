const { Resend } = require('resend');

let client;

// Created on first send so a missing key only fails the send, not app startup.
function getClient() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

function buildLink(path, token) {
  if (!process.env.APP_URL) throw new Error('APP_URL is not set');
  return `${process.env.APP_URL.replace(/\/$/, '')}${path}?token=${encodeURIComponent(token)}`;
}

async function send(toEmail, subject, intro, link) {
  if (!process.env.EMAIL_FROM) throw new Error('EMAIL_FROM is not set');
  // Resend returns API errors as { error } instead of throwing.
  const { data, error } = await getClient().emails.send({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject,
    text: `${intro}\n\n${link}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>${intro}</p><p><a href="${link}">${link}</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
  if (error) throw new Error(`Email send failed: ${error.message}`);
  return data;
}

function sendVerificationEmail(toEmail, token) {
  return send(toEmail, 'Verify your email', 'Click the link below to verify your email address:', buildLink('/verify-email', token));
}

function sendPasswordResetEmail(toEmail, token) {
  return send(toEmail, 'Reset your password', 'Click the link below to reset your password:', buildLink('/reset-password', token));
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
