import { useEffect, useState } from 'react';
import { getAccounts, addAccount, deleteAccount, resetSyncStatus } from '../api/client';
import { useSyncStatusContext } from '../context/SyncStatusContext';
import { PROVIDERS, FIELD_LABELS, getProviderFields, getProviderLabel } from '../utils/providers';

function emptyCredentials(provider) {
  return Object.fromEntries(getProviderFields(provider).map((f) => [f, '']));
}

const DEFAULT_PROVIDER = PROVIDERS[0].value;

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const [displayName, setDisplayName] = useState('');
  const [credentials, setCredentials] = useState(emptyCredentials(DEFAULT_PROVIDER));
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [resettingId, setResettingId] = useState(null);
  const { jobs, triggerSync, refresh: refreshSyncStatus } = useSyncStatusContext();

  function refresh() {
    return getAccounts()
      .then(setAccounts)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    refresh();
  }, []);

  function handleProviderChange(value) {
    setProvider(value);
    setCredentials(emptyCredentials(value));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setPending(true);
    setError('');
    const payload = { provider, displayName, credentials };
    // clear credentials from component state immediately, regardless of outcome
    setDisplayName('');
    setCredentials(emptyCredentials(provider));
    try {
      await addAccount(payload);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('למחוק את החשבון וכל הנתונים שלו? לא ניתן לבטל פעולה זו.')) return;
    try {
      await deleteAccount(id);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  function isAccountActive(accountId) {
    return jobs.some((j) => j.account_id === accountId && (j.status === 'RUNNING' || j.status === 'NEEDS_OTP'));
  }

  async function handleSync(accountId) {
    try {
      await triggerSync(accountId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleResetStuck(accountId) {
    if (!window.confirm('לאפס את מצב הסנכרון עבור חשבון זה? יש לעשות זאת רק אם הסנכרון תקוע ולא באמת רץ כרגע.')) {
      return;
    }
    setResettingId(accountId);
    try {
      await resetSyncStatus(accountId);
      await refreshSyncStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setResettingId(null);
    }
  }

  const fields = getProviderFields(provider);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">חשבונות</h2>

      <div className="rounded-2xl border border-slate-700/50 bg-slate-800 p-5 shadow-lg">
        <h3 className="mb-4 text-sm font-medium text-slate-300">חשבונות שמורים</h3>
        {accounts.length === 0 ? (
          <p className="text-sm text-slate-400">אין עדיין חשבונות.</p>
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
                    onClick={() => handleSync(a.id)}
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
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="rounded-lg border border-red-500 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
                  >
                    מחיקה
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-slate-700/50 bg-slate-800 p-5 shadow-lg">
        <h3 className="mb-4 text-sm font-medium text-slate-300">הוספת חשבון</h3>
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="שם תצוגה"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
          {fields.map((field) => (
            <input
              key={field}
              type={field === 'password' ? 'password' : 'text'}
              placeholder={FIELD_LABELS[field] || field}
              autoComplete="off"
              value={credentials[field] || ''}
              onChange={(e) => setCredentials({ ...credentials, [field]: e.target.value })}
              required
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          ))}
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? 'מוסיף...' : 'הוספת חשבון'}
          </button>
        </form>
        <p className="mt-3 text-xs text-slate-500">פרטי ההתחברות מוצפנים בשרת שלך ואינם יוצאים ממנו לעולם.</p>
      </div>
    </div>
  );
}
