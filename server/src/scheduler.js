const cron = require('node-cron');
const db = require('./db/db');
const { startSync } = require('./sync/engine');

function runNightlySync() {
  const accounts = db.prepare('SELECT id FROM accounts').all();
  let started = 0;

  for (const { id } of accounts) {
    try {
      startSync(id);
      started += 1;
    } catch (err) {
      // A 409 (sync already active) is expected if a manual sync overlaps the
      // scheduled run - log and move on to the next account, never crash.
      console.error(`Scheduled sync skipped for account ${id}: ${err.message}`);
    }
  }

  console.log(`Scheduled sync run: started ${started} syncs`);
}

function startScheduler() {
  const expression = process.env.SYNC_CRON || '0 3 * * *';

  // A headless nightly sync can hit an OTP wall with nobody at the screen.
  // The engine's own OTP timeout (waitForOtp) will mark that job FAILED after
  // its timeout elapses; that is expected and harmless - it does not block
  // tomorrow's scheduled run or a manual retry, since only RUNNING/NEEDS_OTP
  // jobs count as "active" for the per-account concurrency guard.
  cron.schedule(expression, runNightlySync, { timezone: 'Asia/Jerusalem' });
}

module.exports = { startScheduler };
