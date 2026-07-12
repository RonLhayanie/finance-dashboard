const pending = new Map();

function waitForOtp(jobId, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(jobId);
      reject(new Error('OTP timeout'));
    }, timeoutMs);

    pending.set(jobId, { resolve, reject, timer });
  });
}

function submitOtp(jobId, code) {
  const entry = pending.get(jobId);
  if (!entry) {
    return false;
  }
  clearTimeout(entry.timer);
  pending.delete(jobId);
  entry.resolve(code);
  return true;
}

function hasPending(jobId) {
  return pending.has(jobId);
}

// Rejects a pending OTP wait instead of resolving it - used when a job is
// force-reset from the outside (e.g. an admin/user "clear stuck sync" action)
// while this same process still happens to hold a live wait for it.
function cancelOtp(jobId, reason = 'Sync job was reset') {
  const entry = pending.get(jobId);
  if (!entry) {
    return false;
  }
  clearTimeout(entry.timer);
  pending.delete(jobId);
  entry.reject(new Error(reason));
  return true;
}

module.exports = { waitForOtp, submitOtp, hasPending, cancelOtp };
