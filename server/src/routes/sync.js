const express = require('express');
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

  try {
    submitOtpForJob(jobId, code);
    return res.json({ ok: true });
  } catch (err) {
    return handleEngineError(err, res);
  }
});

router.get('/status', (req, res) => {
  res.json(getStatus());
});

// Registered before the generic /:accountId route so it is never shadowed.
router.post('/:accountId/reset', (req, res) => {
  const accountId = Number(req.params.accountId);

  if (!Number.isInteger(accountId)) {
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

  if (!Number.isInteger(accountId)) {
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
