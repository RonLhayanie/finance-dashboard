import { useEffect, useState } from 'react';
import { getAccounts, resetSyncStatus } from '../api/client';
import { useSyncStatusContext } from '../context/SyncStatusContext';
import { getProviderLabel } from '../utils/providers';
import SpendingByCategory from '../components/charts/SpendingByCategory';
import MonthlyTrend from '../components/charts/MonthlyTrend';
import AnomaliesList from '../components/AnomaliesList';

const RANGE_OPTIONS = [
  { key: 'month', label: 'החודש', months: 0 },
  { key: '3months', label: '3 חודשים אחרונים', months: 3 },
  { key: '12months', label: '12 חודשים אחרונים', months: 12 },
];

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function computeRange(months) {
  const to = new Date();
  const from = new Date();
  if (months === 0) {
    from.setDate(1);
  } else {
    from.setMonth(from.getMonth() - months);
  }
  return { from: toISODate(from), to: toISODate(to) };
}

export default function Dashboard() {
  const [rangeKey, setRangeKey] = useState('month');
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState('');
  const [resettingId, setResettingId] = useState(null);
  const { jobs, triggerSync, refresh } = useSyncStatusContext();

  const activeRange = RANGE_OPTIONS.find((r) => r.key === rangeKey);
  const range = computeRange(activeRange.months);

  useEffect(() => {
    let cancelled = false;
    getAccounts()
      .then((data) => !cancelled && setAccounts(data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [jobs]);

  function isAccountActive(accountId) {
    return jobs.some((j) => j.account_id === accountId && (j.status === 'RUNNING' || j.status === 'NEEDS_OTP'));
  }

  async function handleResetStuck(accountId) {
    if (!window.confirm('לאפס את מצב הסנכרון עבור חשבון זה? יש לעשות זאת רק אם הסנכרון תקוע ולא באמת רץ כרגע.')) {
      return;
    }
    setResettingId(accountId);
    try {
      await resetSyncStatus(accountId);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setResettingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-100">לוח בקרה</h2>
        <div className="flex gap-1.5 rounded-xl bg-slate-800/70 p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRangeKey(opt.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                rangeKey === opt.key ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SpendingByCategory from={range.from} to={range.to} />
        <MonthlyTrend />
      </div>

      <AnomaliesList />

      <div className="rounded-2xl border border-slate-700/50 bg-slate-800 p-5 shadow-lg">
        <h3 className="mb-4 text-sm font-medium text-slate-300">חשבונות</h3>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {accounts.length === 0 ? (
          <p className="text-sm text-slate-400">אין עדיין חשבונות. הוסף חשבון בעמוד החשבונות.</p>
        ) : (
          <ul className="divide-y divide-slate-700/70">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm text-slate-100">{a.display_name}</p>
                  <p className="text-xs text-slate-400">
                    {getProviderLabel(a.provider)} - סנכרון אחרון:{' '}
                    {a.last_sync_at ? a.last_sync_at.slice(0, 16) : 'טרם סונכרן'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => triggerSync(a.id)}
                    disabled={isAccountActive(a.id)}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    סנכרן עכשיו
                  </button>
                  {isAccountActive(a.id) && (
                    <button
                      onClick={() => handleResetStuck(a.id)}
                      disabled={resettingId === a.id}
                      title="אם הסנכרון תקוע ולא מתקדם, אפשר לאפס אותו כאן"
                      className="rounded-lg border border-amber-500/60 px-3 py-1.5 text-sm text-amber-400 transition-colors hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {resettingId === a.id ? 'מאפס...' : 'איפוס סנכרון תקוע'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
