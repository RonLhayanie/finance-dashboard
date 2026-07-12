import { useState, useEffect, useRef, useCallback } from 'react';
import { getSyncStatus, startSync } from '../api/client';

const POLL_INTERVAL_MS = 3000;

export function useSyncStatus() {
  const [jobs, setJobs] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(() => new Set());
  const intervalRef = useRef(null);

  const refresh = useCallback(async () => {
    const data = await getSyncStatus();
    setJobs(data);
    return data;
  }, []);

  // Fetch once on mount; clear any interval on unmount.
  useEffect(() => {
    refresh();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [refresh]);

  // Start/stop polling based on whether any job is still in flight.
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === 'RUNNING' || j.status === 'NEEDS_OTP');

    if (hasActive && !intervalRef.current) {
      intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    } else if (!hasActive && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [jobs, refresh]);

  const triggerSync = useCallback(
    async (accountId) => {
      await startSync(accountId);
      await refresh();
    },
    [refresh]
  );

  const dismissFailure = useCallback((jobId) => {
    setDismissedIds((prev) => new Set(prev).add(jobId));
  }, []);

  const activeJob = jobs.find((j) => j.status === 'RUNNING' || j.status === 'NEEDS_OTP') || null;
  const needsOtpJob = jobs.find((j) => j.status === 'NEEDS_OTP') || null;
  const isSyncing = activeJob !== null;
  const failedJobs = jobs.filter((j) => j.status === 'FAILED' && !dismissedIds.has(j.id));

  return { jobs, activeJob, needsOtpJob, isSyncing, failedJobs, dismissFailure, refresh, triggerSync };
}
