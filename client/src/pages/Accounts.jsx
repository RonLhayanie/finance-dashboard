import { useEffect, useState } from 'react';
import { getAccounts, addAccount, deleteAccount, resetSyncStatus } from '../api/client';
import { useSyncStatusContext } from '../context/SyncStatusContext';
import { PROVIDERS, FIELD_LABELS, getProviderFields, getProviderLabel } from '../utils/providers';
import ConfirmModal from '../components/ConfirmModal';

function emptyCredentials(provider) {
  return Object.fromEntries(getProviderFields(provider).map((f) => [f, '']));
}

const DEFAULT_PROVIDER = PROVIDERS[0].value;

// Providers settled through a bank account vs. a standalone card issuer - used
// only to pick an icon for the account tile.
const BANK_PROVIDERS = ['leumi', 'hapoalim', 'discount'];

function formatRelativeTime(lastSyncAt) {
  if (!lastSyncAt) return null;
  const days = Math.floor((Date.now() - new Date(lastSyncAt).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'היום';
  if (days === 1) return 'אתמול';
  return `לפני ${days} ימים`;
}

function getAccountStatus(account, jobs) {
  const job = jobs.find((j) => j.account_id === account.id);
  if (job && job.status === 'RUNNING') {
    return { dot: 'var(--color-warning)', text: 'מסנכרן ומעבד נתונים… (יכול לקחת עד דקה)' };
  }
  if (job && job.status === 'NEEDS_OTP') {
    return { dot: 'var(--color-warning)', text: 'ממתין לקוד אימות' };
  }
  if (job && job.status === 'FAILED') {
    return { dot: 'var(--color-expense)', text: 'החיבור נכשל · בדוק את הפרטים', failed: true };
  }
  if (account.last_sync_at) {
    return { dot: 'var(--color-income)', text: `מחובר · סונכרן ${formatRelativeTime(account.last_sync_at)}`, connected: true };
  }
  return { dot: 'var(--color-warning)', text: 'מאמת חיבור…' };
}

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function BuildingBankIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M3 21l18 0" />
      <path d="M3 10l18 0" />
      <path d="M5 6l7 -3l7 3" />
      <path d="M4 10l0 11" />
      <path d="M20 10l0 11" />
      <path d="M8 14l0 3" />
      <path d="M12 14l0 3" />
      <path d="M16 14l0 3" />
    </svg>
  );
}

function CreditCardIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10l18 0" />
      <path d="M7 15l2 0" />
    </svg>
  );
}

function EyeIcon(props) {
  return (
    <svg {...ICON_PROPS} width={16} height={16} {...props}>
      <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
      <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />
    </svg>
  );
}

function EyeOffIcon(props) {
  return (
    <svg {...ICON_PROPS} width={16} height={16} {...props}>
      <path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" />
      <path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

const inputClass =
  'w-full rounded-lg border px-3 py-2 text-sm text-[var(--color-text)] transition-colors focus:outline-none focus:border-[var(--color-accent)]';
const inputStyle = { backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)' };

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const [displayName, setDisplayName] = useState('');
  const [credentials, setCredentials] = useState(emptyCredentials(DEFAULT_PROVIDER));
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [resettingId, setResettingId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  // Which confirmation dialog is open, if any: { type: 'delete' | 'reset', accountId }
  const [confirmState, setConfirmState] = useState(null);
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
    setShowPassword(false);
    try {
      await addAccount(payload);
      await refresh();
      await refreshSyncStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  async function doDelete(id) {
    try {
      await deleteAccount(id);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleDelete(id) {
    setConfirmState({ type: 'delete', accountId: id });
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

  async function doResetStuck(accountId) {
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

  function handleResetStuck(accountId) {
    setConfirmState({ type: 'reset', accountId });
  }

  function handleConfirmAction() {
    const { type, accountId } = confirmState;
    setConfirmState(null);
    if (type === 'delete') doDelete(accountId);
    else if (type === 'reset') doResetStuck(accountId);
  }

  const fields = getProviderFields(provider);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-[var(--color-text)]">חשבונות</h2>

      <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-surface)' }}>
        <h3 className="mb-4 text-sm font-medium text-[var(--color-text-muted)]">חשבונות שמורים</h3>
        {accounts.length === 0 ? (
          <p className="text-sm text-[var(--color-text-dim)]">אין עדיין חשבונות.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {accounts.map((a) => {
              const Icon = BANK_PROVIDERS.includes(a.provider) ? BuildingBankIcon : CreditCardIcon;
              const status = getAccountStatus(a, jobs);
              return (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg p-3 transition-colors hover:bg-[var(--color-border)]"
                  style={{ backgroundColor: 'var(--color-surface-2)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{ backgroundColor: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}
                    >
                      <Icon />
                    </div>
                    <div>
                      <p className="text-sm text-[var(--color-text)]">{a.display_name}</p>
                      <p className="text-xs text-[var(--color-text-dim)]">{getProviderLabel(a.provider)}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs">
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.dot }} />
                        <span className="text-[var(--color-text-muted)]">{status.text}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSync(a.id)}
                      disabled={isAccountActive(a.id)}
                      className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      סנכרן עכשיו
                    </button>
                    {isAccountActive(a.id) && (
                      <button
                        onClick={() => handleResetStuck(a.id)}
                        disabled={resettingId === a.id}
                        title="אם הסנכרון תקוע ולא מתקדם, אפשר לאפס אותו כאן"
                        className="rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-warning-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ borderColor: 'var(--color-warning)', color: 'var(--color-warning)' }}
                      >
                        {resettingId === a.id ? 'מאפס...' : 'איפוס סנכרון תקוע'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(a.id)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--color-expense)] transition-colors hover:bg-[var(--color-expense-bg)] ${
                        status.failed ? 'border' : ''
                      }`}
                      style={status.failed ? { backgroundColor: 'var(--color-expense-bg)', borderColor: 'var(--color-expense)' } : undefined}
                    >
                      מחיקה
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-surface)' }}>
        <h3 className="mb-4 text-sm font-medium text-[var(--color-text-muted)]">הוספת חשבון</h3>
        {error && <p className="mb-3 text-sm text-[var(--color-expense)]">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className={inputClass}
            style={inputStyle}
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
            className={inputClass}
            style={inputStyle}
          />
          {fields.map((field) =>
            field === 'password' ? (
              <div key={field} className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={FIELD_LABELS[field] || field}
                  autoComplete="off"
                  value={credentials[field] || ''}
                  onChange={(e) => setCredentials({ ...credentials, [field]: e.target.value })}
                  required
                  className={`${inputClass} pl-9`}
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            ) : (
              <input
                key={field}
                type="text"
                placeholder={FIELD_LABELS[field] || field}
                autoComplete="off"
                value={credentials[field] || ''}
                onChange={(e) => setCredentials({ ...credentials, [field]: e.target.value })}
                required
                className={inputClass}
                style={inputStyle}
              />
            )
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? 'מוסיף...' : 'הוספת חשבון'}
          </button>
        </form>
        <p className="mt-3 text-xs text-[var(--color-text-dim)]">פרטי ההתחברות מוצפנים בשרת שלך ואינם יוצאים ממנו לעולם.</p>
      </div>

      <ConfirmModal
        open={confirmState !== null}
        title={confirmState?.type === 'delete' ? 'מחיקת חשבון' : 'איפוס סנכרון'}
        message={
          confirmState?.type === 'delete'
            ? 'למחוק את החשבון וכל הנתונים שלו?'
            : 'לאפס את מצב הסנכרון עבור חשבון זה? יש לעשות זאת רק אם הסנכרון תקוע ולא באמת רץ כרגע.'
        }
        warning={confirmState?.type === 'delete' ? 'לא ניתן לבטל פעולה זו.' : undefined}
        confirmLabel={confirmState?.type === 'delete' ? 'מחק' : 'אפס סנכרון'}
        variant={confirmState?.type === 'delete' ? 'danger' : 'default'}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
