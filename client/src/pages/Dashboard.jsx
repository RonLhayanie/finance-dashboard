import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { getAccounts, resetSyncStatus, getAnomalies, getMonthlyBreakdown, getMonths, getTransactions, getSummary, getInsight } from '../api/client';
import { useSyncStatusContext } from '../context/SyncStatusContext';
import { useChatContext } from '../context/ChatContext';
import { getProviderLabel } from '../utils/providers';
import { getCategoryLabel } from '../utils/categories';
import { formatILS } from '../utils/format';
import SpendingByCategory from '../components/charts/SpendingByCategory';
import MonthlyTrend from '../components/charts/MonthlyTrend';
import ConfirmModal from '../components/ConfirmModal';

const RANGE_OPTIONS = [
  { key: 'month', label: 'החודש', months: 0 },
  { key: '3months', label: '3 חודשים אחרונים', months: 3 },
  { key: '12months', label: '12 חודשים אחרונים', months: 12 },
];

// Providers settled through a bank account vs. a standalone card issuer - used
// only to pick an icon for the account tile.
const BANK_PROVIDERS = ['leumi', 'hapoalim', 'discount'];

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

// Full first-to-last-day range for a single "YYYY-MM" - used when the month
// picker selects one specific month instead of "all periods".
function monthRange(yyyymm) {
  const [y, m] = yyyymm.split('-').map(Number);
  return { from: toISODate(new Date(y, m - 1, 1)), to: toISODate(new Date(y, m, 0)) };
}

function formatMonthLabel(yyyymm) {
  const [y, m] = yyyymm.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
}

function formatRelativeDays(lastSyncAt) {
  if (!lastSyncAt) return null;
  const days = Math.floor((Date.now() - new Date(lastSyncAt).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'היום';
  if (days === 1) return 'אתמול';
  return `לפני ${days} ימים`;
}

function useCountUp(target, durationMs = 800) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / durationMs, 1);
      setValue(Math.round(target * progress));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [target, durationMs]);

  return value;
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

function AlertTriangleIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M12 9v4" />
      <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" />
      <path d="M12 16h.01" />
    </svg>
  );
}

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

function ArrowUpIcon(props) {
  return (
    <svg {...ICON_PROPS} width={14} height={14} {...props}>
      <path d="M12 5l0 14" />
      <path d="M6 11l6 -6l6 6" />
    </svg>
  );
}

function ArrowDownIcon(props) {
  return (
    <svg {...ICON_PROPS} width={14} height={14} {...props}>
      <path d="M12 5l0 14" />
      <path d="M18 13l-6 6l-6 -6" />
    </svg>
  );
}

function ChevronDownIcon(props) {
  return (
    <svg {...ICON_PROPS} width={14} height={14} {...props}>
      <path d="M6 9l6 6l6 -6" />
    </svg>
  );
}

function SparklesIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z" />
    </svg>
  );
}

function computeAvgExpense(monthly) {
  return monthly.length ? monthly.reduce((sum, r) => sum + r.expense, 0) / monthly.length : 0;
}

function AnomalyStrip({ accountId, from, to }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAnomalies({ account_id: accountId, from, to })
      .then((data) => !cancelled && setRows(data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accountId, from, to]);

  if (rows.length === 0) return null;
  const shown = rows.slice(0, 3);
  const remaining = rows.length - shown.length;

  return (
    <div
      className="animate-in flex flex-col gap-2 rounded-xl px-4 py-3"
      style={{ backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
    >
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangleIcon />
          {rows.length} חריגות זוהו
        </p>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[var(--color-surface-2)]"
          style={{ color: 'var(--color-warning)' }}
        >
          פרטים נוספים
          <ChevronDownIcon
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}
          />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {shown.map((r, i) => (
          <span
            key={i}
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs"
            style={{ backgroundColor: 'var(--color-surface-2)' }}
          >
            <span className="text-[var(--color-text)]">
              {(r.description || '').length > 30 ? `${r.description.slice(0, 30)}…` : r.description}
            </span>
            <span style={{ color: 'var(--color-expense)' }}>{formatILS(r.amount)}</span>
            <span className="text-[var(--color-text-dim)]">{r.date.slice(0, 10)}</span>
          </span>
        ))}
        {remaining > 0 && !expanded && (
          <span className="flex items-center px-2.5 py-1.5 text-xs text-[var(--color-text-muted)]">ועוד {remaining}</span>
        )}
      </div>
      {expanded && (
        <div className="mt-1 flex flex-col gap-1 rounded-lg p-2" style={{ backgroundColor: 'var(--color-surface-2)' }}>
          {rows.map((r, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-[var(--color-surface)]"
            >
              <span className="text-[var(--color-text)]">{r.description}</span>
              <span className="flex items-center gap-2">
                <span style={{ color: 'var(--color-expense)' }}>{formatILS(r.amount)}</span>
                <span className="text-[var(--color-text-dim)]">{r.date.slice(0, 10)}</span>
                {/* TODO: surface the real trigger reason from the backend anomaly
                    detector (analytics/anomalies.js) instead of this generic label -
                    the detector currently only flags rows via a category z-score
                    threshold and doesn't persist a reason string. */}
                <span className="text-[var(--color-text-muted)]">{r.reason || 'גבוה משמעותית מהממוצע בקטגוריה'}</span>
              </span>
            </div>
          ))}
          <button
            onClick={() => navigate('/transactions?anomaly=1')}
            className="mt-1 cursor-pointer self-start text-xs font-medium text-[var(--color-accent)] transition-colors hover:text-[var(--color-accent-strong)]"
          >
            לכל החריגות
          </button>
        </div>
      )}
    </div>
  );
}

// Below this monthly average a percentage is noise, not a trend: a bank account
// whose spending is almost all card_payment (excluded from analytics) averages a
// few shekels, so one ATM withdrawal reads as +1000%.
// A fixed ILS floor; if it ever hides a real account, make it relative instead
// (e.g. to the all-accounts average).
const MIN_AVG_FOR_PCT = 100;

function MetricCards({ monthly }) {
  const currentMonth = monthly.length ? monthly[monthly.length - 1] : { income: 0, expense: 0 };
  const avgExpense = computeAvgExpense(monthly);
  const showPct = avgExpense >= MIN_AVG_FOR_PCT;
  const pctVsAvg = showPct ? ((currentMonth.expense - avgExpense) / avgExpense) * 100 : 0;
  const expenseValue = useCountUp(Math.round(currentMonth.expense));
  const isAboveAvg = pctVsAvg > 0;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.5fr_1fr_1fr]">
      <div
        className="animate-in rounded-xl p-[18px] transition-colors hover:bg-[var(--color-surface-2)]"
        style={{ backgroundColor: 'var(--color-surface)', animationDelay: '0ms' }}
      >
        <p className="text-sm text-[var(--color-text-muted)]">הוצאות החודש</p>
        <p className="mt-2 font-serif text-[34px] leading-none text-[var(--color-text)]">{formatILS(expenseValue)}</p>
        {showPct && (
          <p
            className="mt-2 flex items-center gap-1 text-sm"
            style={{ color: isAboveAvg ? 'var(--color-expense)' : 'var(--color-income)' }}
          >
            {isAboveAvg ? <ArrowUpIcon /> : <ArrowDownIcon />}
            {Math.abs(pctVsAvg).toFixed(0)}% {isAboveAvg ? 'מעל ממוצע' : 'מתחת לממוצע'}
          </p>
        )}
      </div>

      <div
        className="animate-in rounded-xl p-[18px] transition-colors hover:bg-[var(--color-surface-2)]"
        style={{ backgroundColor: 'var(--color-surface)', animationDelay: '80ms' }}
      >
        <p className="text-sm text-[var(--color-text-muted)]">הכנסות</p>
        <p className="mt-2 text-[26px] leading-none" style={{ color: 'var(--color-income)' }}>
          {formatILS(currentMonth.income)}
        </p>
      </div>

      <div
        className="animate-in rounded-xl p-[18px] transition-colors hover:bg-[var(--color-surface-2)]"
        style={{ backgroundColor: 'var(--color-surface)', animationDelay: '160ms' }}
      >
        <p className="text-sm text-[var(--color-text-muted)]">ממוצע חודשי</p>
        <p className="mt-2 text-[26px] leading-none text-[var(--color-text)]">{formatILS(avgExpense)}</p>
      </div>
    </div>
  );
}

function ForecastCard({ avgExpense }) {
  const [txns, setTxns] = useState(null);
  const [error, setError] = useState('');

  const now = new Date();
  const year = now.getFullYear();
  const monthIdx = now.getMonth();
  const totalDays = new Date(year, monthIdx + 1, 0).getDate();
  const today = now.getDate();
  const fromISO = toISODate(new Date(year, monthIdx, 1));
  const toISO = toISODate(now);
  const monthNameHe = now.toLocaleDateString('he-IL', { month: 'long' });

  useEffect(() => {
    let cancelled = false;
    // NOTE: the transactions endpoint caps at limit=200 per request (server-side
    // clamp in routes/transactions.js). If a month has more than 200 transactions
    // this cumulative chart will silently be incomplete - no pagination added here
    // per scope (no backend changes this stage).
    getTransactions({ from: fromISO, to: toISO, limit: 200 })
      .then((res) => !cancelled && setTxns(res.rows))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [fromISO, toISO]);

  let chartData = [];
  let projectedTotal = 0;
  let spendSoFar = 0;

  if (txns) {
    const byDay = new Array(totalDays + 1).fill(0);
    for (const t of txns) {
      if (t.amount >= 0) continue;
      const d = new Date(t.date).getDate();
      if (d >= 1 && d <= totalDays) byDay[d] += -t.amount;
    }
    let running = 0;
    const cumulative = byDay.map((v) => (running += v));
    spendSoFar = cumulative[today] || 0;
    const dailyRate = today > 0 ? spendSoFar / today : 0;
    projectedTotal = dailyRate * totalDays;

    for (let day = 1; day <= totalDays; day++) {
      chartData.push({
        day: `${day}`,
        actual: day <= today ? cumulative[day] : null,
        projected: day >= today ? dailyRate * day : null,
        avg: avgExpense > 0 ? avgExpense : null,
      });
    }
  }

  const aboveAvg = avgExpense > 0 && projectedTotal > avgExpense;

  return (
    <div
      className="animate-in rounded-xl p-[18px]"
      style={{ backgroundColor: 'var(--color-surface)', animationDelay: '240ms' }}
    >
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--color-text-muted)]">תחזית הוצאות · {monthNameHe}</h3>
        {txns && <p className="text-sm font-semibold text-[var(--color-text)]">צפי לסיום: {formatILS(projectedTotal)}</p>}
      </div>
      <p className="mb-2 text-sm text-[var(--color-text-muted)]">
        הקו המלא הוא ההוצאה שנצברה החודש, המקווקו הוא התחזית לסוף החודש לפי הקצב הנוכחי.
      </p>
      {txns && avgExpense > 0 && (
        <p className="mb-2 text-sm text-[var(--color-text-muted)]">
          {aboveAvg ? 'מעל הממוצע החודשי הרגיל' : 'מתחת לממוצע החודשי הרגיל'}
        </p>
      )}
      {error && <p className="text-sm" style={{ color: 'var(--color-expense)' }}>{error}</p>}
      {!error && txns === null && <p className="text-sm text-[var(--color-text-dim)]">טוען...</p>}
      {!error && txns !== null && (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="0" stroke="#262b38" vertical={false} />
            <XAxis dataKey="day" stroke="#6b6e80" fontSize={11} tickLine={false} axisLine={{ stroke: '#262b38' }} />
            <YAxis
              stroke="#6b6e80"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => new Intl.NumberFormat('he-IL').format(v)}
            />
            <RechartsTooltip formatter={(v) => formatILS(v)} contentStyle={{ backgroundColor: '#171a23', borderColor: '#262b38' }} />
            <Line type="monotone" dataKey="actual" stroke="#7f77dd" strokeWidth={2} dot={false} connectNulls={false} />
            <Line
              type="monotone"
              dataKey="projected"
              stroke="#7f77dd"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              connectNulls={false}
            />
            <Line type="monotone" dataKey="avg" stroke="#6b6e80" strokeWidth={1} strokeDasharray="2 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function InsightCard() {
  const navigate = useNavigate();
  const { setPendingPrompt } = useChatContext();
  const [insight, setInsight] = useState('');
  const [generatedAt, setGeneratedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;

    function fallbackToClientComputed() {
      const now = new Date();
      const from = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
      const to = toISODate(now);
      getSummary({ from, to, groupBy: 'category' })
        .then((rows) => {
          if (cancelled) return;
          const top = rows.filter((r) => r.total < 0).sort((a, b) => a.total - b.total)[0];
          if (top) {
            setInsight(`הקטגוריה הגדולה ביותר החודש היא ${getCategoryLabel(top.group_key)} עם ${formatILS(Math.abs(top.total))}.`);
          } else {
            setInsight('התובנה תתעדכן בסנכרון הבא.');
          }
        })
        .catch(() => {});
    }

    getInsight()
      .then((data) => {
        if (cancelled) return;
        if (data && data.text) {
          setInsight(data.text);
          setGeneratedAt(data.generated_at);
        } else {
          // No AI insight persisted yet (no sync has completed with it) - fall
          // back to a simple client-side computation so the card is never empty.
          fallbackToClientComputed();
        }
      })
      .catch(() => {
        if (!cancelled) fallbackToClientComputed();
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="animate-in rounded-xl p-[18px]"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-accent)' }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}
          >
            <SparklesIcon width={16} height={16} />
          </div>
          <span className="text-sm font-medium text-[var(--color-accent)]">תובנת AI</span>
        </div>
        <span className="text-xs text-[var(--color-text-dim)]">
          {generatedAt ? `עודכן ${formatRelativeDays(generatedAt)}` : ''}
        </span>
      </div>
      <p className="text-sm text-[var(--color-text)]">{insight}</p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => {
            setPendingPrompt('פרט לי עוד על התובנה של החודש');
            navigate('/chat');
          }}
          className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-strong)]"
        >
          פרט לי עוד
        </button>
        <button
          onClick={() => {
            setPendingPrompt('איך אפשר לחסוך על סמך ההוצאות שלי?');
            navigate('/chat');
          }}
          className="rounded-lg bg-[var(--color-accent-bg)] px-3 py-1.5 text-sm font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-surface-2)]"
        >
          איך אפשר לחסוך?
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rangeKey, setRangeKey] = useState('month');
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState('');
  const [resettingId, setResettingId] = useState(null);
  const [confirmResetId, setConfirmResetId] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [months, setMonths] = useState([]);
  const { jobs, triggerSync, refresh } = useSyncStatusContext();

  // selectedAccount/selectedMonth live in the URL (?account=, ?month=), not
  // local state - that's the single source of truth, so there's nothing to
  // resync: browser back/forward, a bookmarked link, or a fresh mount after
  // navigating away and back all just re-read the current URL.
  const rawAccountParam = searchParams.get('account') || 'all';
  // Guard against a deleted account still referenced in an old URL/bookmark -
  // (accounts || []) also makes this safe before accounts finishes loading.
  const accountParamIsValid =
    rawAccountParam === 'all' || (accounts || []).some((a) => String(a.id) === rawAccountParam);
  const selectedAccount = accountParamIsValid ? rawAccountParam : 'all';
  const selectedMonth = searchParams.get('month') || 'all';
  const hasActiveFilter = selectedAccount !== 'all' || selectedMonth !== 'all';

  function setFilterParam(key, value) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === 'all') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      return next;
    });
  }

  function clearFilters() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('account');
      next.delete('month');
      return next;
    });
  }

  const activeRange = RANGE_OPTIONS.find((r) => r.key === rangeKey);
  // The month picker overrides the quick range picker when a specific month
  // is chosen; "all periods" falls back to the existing behavior unchanged.
  const range = selectedMonth === 'all' ? computeRange(activeRange.months) : monthRange(selectedMonth);
  const accountId = selectedAccount === 'all' ? undefined : Number(selectedAccount);
  const avgExpense = computeAvgExpense(monthly);

  useEffect(() => {
    let cancelled = false;
    getAccounts()
      .then((data) => !cancelled && setAccounts(data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [jobs]);

  useEffect(() => {
    let cancelled = false;
    getMonthlyBreakdown({ account_id: accountId })
      .then((rows) => !cancelled && setMonthly(rows))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  useEffect(() => {
    let cancelled = false;
    getMonths()
      .then((data) => !cancelled && setMonths(data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (accounts === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="animate-in flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <BuildingBankIcon width={48} height={48} style={{ color: 'var(--color-accent)' }} />
        <h2 className="text-3xl font-semibold tracking-tight text-[var(--color-text)]">ברוך הבא ללוח הבקרה</h2>
        <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
          עדיין אין חשבון מחובר. חבר את החשבון הראשון שלך כדי להתחיל לראות את התמונה הפיננסית שלך.
        </p>
        <button
          onClick={() => navigate('/accounts')}
          className="mt-2 cursor-pointer rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-strong)]"
        >
          חבר חשבון
        </button>
      </div>
    );
  }

  function isAccountActive(accountId) {
    return jobs.some((j) => j.account_id === accountId && (j.status === 'RUNNING' || j.status === 'NEEDS_OTP'));
  }

  async function doResetStuck(accountId) {
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

  function handleResetStuck(accountId) {
    setConfirmResetId(accountId);
  }

  function handleConfirmReset() {
    const accountId = confirmResetId;
    setConfirmResetId(null);
    doResetStuck(accountId);
  }

  function getAccountStatus(account) {
    const job = jobs.find((j) => j.account_id === account.id);
    if (job && job.status === 'RUNNING') {
      return { dot: 'var(--color-warning)', text: 'מסנכרן ומעבד נתונים… (יכול לקחת עד דקה)' };
    }
    if (job && job.status === 'NEEDS_OTP') {
      return { dot: 'var(--color-warning)', text: 'ממתין לקוד אימות' };
    }
    if (job && job.status === 'FAILED') {
      return { dot: 'var(--color-expense)', text: 'הסנכרון נכשל' };
    }
    if (!account.last_sync_at) {
      return { dot: 'var(--color-warning)', text: 'טרם סונכרן' };
    }
    const days = Math.floor((Date.now() - new Date(account.last_sync_at).getTime()) / (1000 * 60 * 60 * 24));
    const rel = formatRelativeDays(account.last_sync_at);
    if (days <= 3) {
      return { dot: 'var(--color-income)', text: `מחובר · סונכרן ${rel}`, connected: true };
    }
    return { dot: 'var(--color-warning)', text: `דורש סנכרון · ${rel}` };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">לוח בקרה</h2>
        <div className="flex flex-wrap items-center gap-2">
          {/* Always mounted, at the far-right edge (first in DOM = rightmost
              in RTL), right of the account selector. Only opacity/pointer-
              events toggle with hasActiveFilter, so its box always reserves
              its space and the selectors after it never shift. */}
          <button
            onClick={clearFilters}
            tabIndex={hasActiveFilter ? 0 : -1}
            className={`cursor-pointer text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)] ${
              hasActiveFilter ? '' : 'pointer-events-none opacity-0'
            }`}
          >
            נקה סינון
          </button>
          <select
            value={selectedAccount}
            onChange={(e) => setFilterParam('account', e.target.value)}
            className="cursor-pointer rounded-lg border px-3 py-1.5 text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <option value="all">הכל</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.display_name}
              </option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setFilterParam('month', e.target.value)}
            className="cursor-pointer rounded-lg border px-3 py-1.5 text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <option value="all">כל התקופה</option>
            {[...months].reverse().map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>
          <div className="flex gap-1.5 rounded-xl p-1" style={{ backgroundColor: 'var(--color-surface-2)' }}>
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setRangeKey(opt.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  rangeKey === opt.key
                    ? 'bg-[var(--color-accent)] text-white shadow hover:bg-[var(--color-accent-strong)]'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <InsightCard />

      <AnomalyStrip accountId={accountId} from={range.from} to={range.to} />

      <MetricCards monthly={monthly} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div
          className="animate-in rounded-xl p-[18px]"
          style={{ backgroundColor: 'var(--color-surface)', animationDelay: '240ms' }}
        >
          <MonthlyTrend accountId={accountId} />
        </div>
        <div
          className="animate-in rounded-xl p-[18px]"
          style={{ backgroundColor: 'var(--color-surface)', animationDelay: '240ms' }}
        >
          <SpendingByCategory from={range.from} to={range.to} accountId={accountId} />
        </div>
      </div>

      <ForecastCard avgExpense={avgExpense} />

      <div
        className="animate-in rounded-xl p-5"
        style={{ backgroundColor: 'var(--color-surface)', animationDelay: '320ms' }}
      >
        <h3 className="mb-4 text-sm font-medium text-[var(--color-text-muted)]">חשבונות</h3>
        {error && <p className="text-sm" style={{ color: 'var(--color-expense)' }}>{error}</p>}
        {accounts?.length === 0 ? (
          <p className="text-sm text-[var(--color-text-dim)]">אין עדיין חשבונות. הוסף חשבון בעמוד החשבונות.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {accounts?.map((a) => {
              const Icon = BANK_PROVIDERS.includes(a.provider) ? BuildingBankIcon : CreditCardIcon;
              const status = getAccountStatus(a);
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-lg p-3"
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
                      onClick={() => triggerSync(a.id)}
                      disabled={isAccountActive(a.id)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        status.connected
                          ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white'
                          : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-strong)]'
                      }`}
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
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmModal
        open={confirmResetId !== null}
        title="איפוס סנכרון"
        message="לאפס את מצב הסנכרון עבור חשבון זה? יש לעשות זאת רק אם הסנכרון תקוע ולא באמת רץ כרגע."
        confirmLabel="אפס סנכרון"
        variant="default"
        onConfirm={handleConfirmReset}
        onCancel={() => setConfirmResetId(null)}
      />
    </div>
  );
}
