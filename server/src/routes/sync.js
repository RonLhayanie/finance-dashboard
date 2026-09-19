const express = require('express');
const db = require('../db/db');
const { startSync, submitOtpForJob, resetStuckJobs, getStatus, NotFoundError, ConflictError } = require('../sync/engine');

const router = express.Router();

function handleEngineError(err, res) {
  if (err instanceof NotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  if (err instanceof ConflictError) {
    return res.status(409).json({ error: err.message });
  }
  throw err;
}

// sync/engine.js has no concept of users - it operates on bare account/job
// ids. Ownership must be checked here, in the route layer, before any
// engine function runs, so a user can't act on or learn about another
// user's account/job by guessing its id. Not found and not-yours both 404
// with the same message, same as accounts.js - never 403.
function ownsAccount(accountId, userId) {
  return !!db.prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?').get(accountId, userId);
}

// Registered before the generic /:accountId route so it is never shadowed.
router.post('/:jobId/otp', (req, res) => {
  const jobId = Number(req.params.jobId);
  const { code } = req.body || {};

  if (!Number.isInteger(jobId)) {
    return res.status(404).json({ error: `Sync job not found: ${req.params.jobId}` });
  }
  if (typeof code !== 'string' || !/^\d{4,8}$/.test(code)) {
    return res.status(400).json({ error: 'code must be a string of 4-8 digits' });
  }

  const job = db.prepare('SELECT account_id FROM sync_jobs WHERE id = ?').get(jobId);
  if (!job || !ownsAccount(job.account_id, req.userId)) {
    return res.status(404).json({ error: `Sync job not found: ${jobId}` });
  }

  try {
    submitOtpForJob(jobId, code);
    return res.json({ ok: true });
  } catch (err) {
    return handleEngineError(err, res);
  }
});

router.get('/status', (req, res) => {
  const ownedIds = new Set(db.prepare('SELECT id FROM accounts WHERE user_id = ?').all(req.userId).map((r) => r.id));
  res.json(getStatus().filter((row) => ownedIds.has(row.account_id)));
});

// Registered before the generic /:accountId route so it is never shadowed.
router.post('/:accountId/reset', (req, res) => {
  const accountId = Number(req.params.accountId);

  if (!Number.isInteger(accountId) || !ownsAccount(accountId, req.userId)) {
    return res.status(404).json({ error: `Account not found: ${req.params.accountId}` });
  }

  try {
    const result = resetStuckJobs(accountId);
    return res.json({ ok: true, ...result });
  } catch (err) {
    return handleEngineError(err, res);
  }
});

router.post('/:accountId', (req, res) => {
  const accountId = Number(req.params.accountId);

  if (!Number.isInteger(accountId) || !ownsAccount(accountId, req.userId)) {
    return res.status(404).json({ error: `Account not found: ${req.params.accountId}` });
  }

  try {
    const { jobId } = startSync(accountId);
    return res.status(202).json({ jobId });
  } catch (err) {
    return handleEngineError(err, res);
  }
});

module.exports = router;
