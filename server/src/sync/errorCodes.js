// Classifies a raw sync_jobs.error message into a stable code the frontend can
// map to a user-facing string, without needing a schema change or touching how
// errors are stored (engine.js keeps storing scraper/library messages as-is).
const ERROR_PATTERNS = [
  { code: 'invalid_credentials', test: (msg) => /INVALID_PASSWORD/.test(msg) },
  { code: 'account_blocked', test: (msg) => /ACCOUNT_BLOCKED/.test(msg) },
  { code: 'change_password_required', test: (msg) => /CHANGE_PASSWORD/.test(msg) },
  { code: 'otp_timeout', test: (msg) => /OTP timeout/i.test(msg) },
  { code: 'timeout', test: (msg) => /\bTIMEOUT\b/.test(msg) },
  { code: 'two_factor_unsupported', test: (msg) => /TWO_FACTOR_RETRIEVER_MISSING/.test(msg) },
  { code: 'unsupported_provider', test: (msg) => /Unsupported provider/.test(msg) },
  { code: 'manually_reset', test: (msg) => /manually reset/i.test(msg) },
];

function classifySyncError(message) {
  if (!message) return null;
  const match = ERROR_PATTERNS.find((p) => p.test(message));
  return match ? match.code : 'unknown';
}

module.exports = { classifySyncError };
