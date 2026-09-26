import { useEffect, useState } from 'react';
import { getSubscriptions } from '../api/client';
import { formatILS } from '../utils/format';

const FREQUENCY_LABELS = { monthly: 'חודשי', yearly: 'שנתי' };
const STATUS_LABELS = { active: 'פעיל', cancelled: 'בוטל' };

export default function SubscriptionsTable() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSubscriptions()
      .then((data) => !cancelled && setRows(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = [...rows].sort((a, b) => b.amount - a.amount);
  const monthlyTotal = rows
    .filter((r) => r.status === 'active')
    .reduce((sum, r) => sum + (r.frequency === 'monthly' ? r.amount : r.amount / 12), 0);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--color-text-muted)]">מנויים</h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          סה״כ חודשי: <span className="font-semibold text-[var(--color-text)]">{formatILS(monthlyTotal)}</span>
        </p>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
        </div>
      )}
      {!loading && error && <p className="text-sm text-[var(--color-expense)]">{error}</p>}
      {!loading && !error && sorted.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] py-10 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">לא זוהו חיובים חוזרים עדיין.</p>
        </div>
      )}
      {!loading && !error && sorted.length > 0 && (
        <table className="w-full text-start text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
              <th className="px-2 pb-2 text-start font-medium">ספק</th>
              <th className="px-2 pb-2 text-start font-medium">סכום</th>
              <th className="px-2 pb-2 text-start font-medium">תדירות</th>
              <th className="px-2 pb-2 text-start font-medium">חיוב אחרון</th>
              <th className="px-2 pb-2 text-start font-medium">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr
                key={i}
                className="border-b border-[var(--color-border)] transition-colors last:border-0 hover:bg-[var(--color-surface-2)]"
              >
                <td className="px-2 py-2.5 capitalize text-[var(--color-text)]">{r.merchant}</td>
                <td className="px-2 py-2.5 font-medium text-[var(--color-expense)]">{formatILS(r.amount)}</td>
                <td className="px-2 py-2.5">
                  <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                    {FREQUENCY_LABELS[r.frequency] || r.frequency}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-[var(--color-text-muted)]">{r.last_charged?.slice(0, 10)}</td>
                <td className="px-2 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.status === 'active'
                        ? 'bg-[var(--color-income-bg)] text-[var(--color-income)]'
                        : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    {STATUS_LABELS[r.status] || r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
