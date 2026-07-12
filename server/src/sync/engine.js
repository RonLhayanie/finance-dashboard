const db = require('../db/db');
const vault = require('../crypto/vault');
const { waitForOtp, submitOtp, cancelOtp } = require('./otpBridge');
const { runScrape } = require('./scraper');
const { categorizeAll } = require('../analytics/categorize');
const { detectSubscriptions } = require('../analytics/subscriptions');
const { detectAnomalies } = require('../analytics/anomalies');
const { classifySyncError } = require('./errorCodes');

class NotFoundError extends Error {}
class ConflictError extends Error {}

function setStatus(jobId, status) {
  db.prepare('UPDATE sync_jobs SET status = ? WHERE id = ?').run(status, jobId);
}

function markFailed(jobId, message) {
  db.prepare(
    "UPDATE sync_jobs SET status = 'FAILED', error = ?, finished_at = datetime('now'), otp_code = NULL WHERE id = ?"
  ).run(message, jobId);
}

async function runSyncJob(jobId, account, scraperFn) {
  const credentialsJson = vault.decrypt(
    account.credentials_encrypted,
    account.credentials_iv,
    account.credentials_tag
  );
  const credentials = JSON.parse(credentialsJson);

  const otpRetriever = async () => {
    setStatus(jobId, 'NEEDS_OTP');
    const code = await waitForOtp(jobId);
    setStatus(jobId, 'RUNNING');
    return code;
  };

  const result = await scraperFn({
    provider: account.provider,
    credentials,
    otpRetriever,
  });

  const insertTxn = db.prepare(`
    INSERT OR IGNORE INTO transactions (account_id, external_id, date, amount, currency, description)
    VALUES (@accountId, @externalId, @date, @amount, @currency, @description)
  `);

  const insertAll = db.transaction((accounts) => {
    for (const account_ of accounts) {
      for (const txn of account_.txns) {
        insertTxn.run({
          accountId: account.id,
          externalId: txn.externalId,
          date: txn.date,
          amount: txn.amount,
          currency: txn.currency,
          description: txn.description,
        });
      }
    }
  });
  insertAll(result.accounts || []);

  // Post-sync analytics hook: categorize new rows, then refresh subscriptions
  // and anomaly flags now that categories are up to date.
  categorizeAll(db);
  detectSubscriptions(db);
  detectAnomalies(db);

  db.prepare("UPDATE accounts SET last_sync_at = datetime('now') WHERE id = ?").run(account.id);
  db.prepare(
    "UPDATE sync_jobs SET status = 'DONE', finished_at = datetime('now'), otp_code = NULL WHERE id = ?"
  ).run(jobId);
}

function startSync(accountId, scraperFn = runScrape) {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
  if (!account) {
    throw new NotFoundError(`Account not found: ${accountId}`);
  }

  const active = db
    .prepare(
      "SELECT id FROM sync_jobs WHERE account_id = ? AND status IN ('RUNNING', 'NEEDS_OTP') LIMIT 1"
    )
    .get(accountId);
  if (active) {
    throw new ConflictError(`Sync already in progress for account ${accountId}`);
  }

  const insert = db
    .prepare("INSERT INTO sync_jobs (account_id, status) VALUES (?, 'RUNNING')")
    .run(accountId);
  const jobId = insert.lastInsertRowid;

  runSyncJob(jobId, account, scraperFn).catch((err) => {
    markFailed(jobId, err.message);
  });

  return { jobId };
}

function submitOtpForJob(jobId, code) {
  const job = db.prepare('SELECT * FROM sync_jobs WHERE id = ?').get(jobId);
  if (!job) {
    throw new NotFoundError(`Sync job not found: ${jobId}`);
  }
  if (job.status !== 'NEEDS_OTP') {
    throw new ConflictError(`Sync job ${jobId} is not awaiting OTP (status: ${job.status})`);
  }

  db.prepare('UPDATE sync_jobs SET otp_code = ? WHERE id = ?').run(code, jobId);
  const submitted = submitOtp(jobId, code);
  if (!submitted) {
    throw new ConflictError(`No pending OTP wait for job ${jobId}`);
  }
}

// Force-clears any RUNNING/NEEDS_OTP job(s) stuck against an account (e.g.
// after a server restart mid-sync left a row with no process actually working
// on it), so a new sync can be started. The schema's CHECK constraint only
// allows RUNNING/NEEDS_OTP/DONE/FAILED - there is no 'IDLE' status - so stuck
// jobs are marked FAILED with a distinguishable message rather than deleted,
// keeping the job history intact.
// Note: if a job is reset while it is genuinely still executing in this same
// process (not actually stuck), that in-flight work has no cancellation hook
// (the scrape promise can't be aborted mid-flight) - cancelOtp only rejects an
// in-memory NEEDS_OTP wait if one exists here, and the original run's eventual
// completion may still write its own terminal status afterward.
function resetStuckJobs(accountId) {
  const account = db.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId);
  if (!account) {
    throw new NotFoundError(`Account not found: ${accountId}`);
  }

  const stuck = db
    .prepare("SELECT id FROM sync_jobs WHERE account_id = ? AND status IN ('RUNNING', 'NEEDS_OTP')")
    .all(accountId);

  const resetOne = db.prepare(
    "UPDATE sync_jobs SET status = 'FAILED', error = ?, finished_at = datetime('now'), otp_code = NULL WHERE id = ?"
  );
  const resetAll = db.transaction((jobs) => {
    for (const job of jobs) {
      cancelOtp(job.id, 'Sync manually reset by user');
      resetOne.run('Sync manually reset by user', job.id);
    }
  });
  resetAll(stuck);

  return { resetCount: stuck.length };
}

function getStatus() {
  const rows = db
    .prepare(
      `SELECT sj.id, sj.account_id, sj.status, sj.error, sj.started_at, sj.finished_at
       FROM sync_jobs sj
       INNER JOIN (
         SELECT account_id, MAX(id) AS max_id
         FROM sync_jobs
         GROUP BY account_id
       ) latest ON latest.account_id = sj.account_id AND latest.max_id = sj.id
       ORDER BY sj.account_id`
    )
    .all();

  return rows.map((row) => ({
    ...row,
    errorCode: row.status === 'FAILED' ? classifySyncError(row.error) : null,
  }));
}

module.exports = { startSync, submitOtpForJob, resetStuckJobs, getStatus, NotFoundError, ConflictError };
