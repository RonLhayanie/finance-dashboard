import { useEffect, useState } from 'react';
import { useSyncStatusContext } from '../context/SyncStatusContext';
import { getSyncErrorMessage } from '../utils/syncErrors';
import { getAccounts } from '../api/client';

export default function SyncErrorToast() {
  const { failedJobs, dismissFailure } = useSyncStatusContext();
  const [accountNames, setAccountNames] = useState({});

  useEffect(() => {
    if (failedJobs.length === 0) return;
    getAccounts()
      .then((accounts) => {
        setAccountNames(Object.fromEntries(accounts.map((a) => [a.id, a.display_name])));
      })
      .catch(() => {});
  }, [failedJobs.length]);

  if (failedJobs.length === 0) return null;

  return (
    <div className="fixed top-4 end-4 z-40 flex w-full max-w-sm flex-col gap-2">
      {failedJobs.map((job) => (
        <div
          key={job.id}
          className="flex items-start gap-3 rounded-xl border border-red-500/50 bg-slate-800 px-4 py-3 shadow-xl"
        >
          <div className="flex-1">
            <p className="text-sm font-medium text-red-400">
              הסנכרון נכשל{accountNames[job.account_id] ? ` - ${accountNames[job.account_id]}` : ''}
            </p>
            <p className="mt-1 text-sm text-slate-200">{getSyncErrorMessage(job.errorCode)}</p>
          </div>
          <button
            onClick={() => dismissFailure(job.id)}
            className="shrink-0 text-slate-400 hover:text-slate-200"
            aria-label="סגירה"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
