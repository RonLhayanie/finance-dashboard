import { useEffect, useState } from 'react';
import { getSubscriptions } from '../api/client';
import { formatILS } from '../utils/format';

const FREQUENCY_LABELS = { monthly: 'חודשי', yearly: 'שנתי' };
const STATUS_LABELS = { active: 'פעיל', cancelled: 'בוטל' };

export default function SubscriptionsTable() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getSubscriptions()
      .then((data) => !cancelled && setRows(data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = [...rows].sort((a, b) => b.amount - a.amount);
  const monthlyTotal = rows
    .filter((r) => r.status === 'active')
    .reduce((sum, r) => sum + (r.frequency === 'monthly' ? r.amount : r.amount / 12), 0);

  return (
    <div className="rounded-xl bg-slate-800 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300">מנויים</h3>
        <p className="text-sm text-slate-100">
          סה״כ חודשי: <span className="font-semibold text-emerald-400">{formatILS(monthlyTotal)}</span>
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!error && sorted.length === 0 && <p className="text-sm text-slate-400">לא זוהו חיובים חוזרים עדיין.</p>}
      {!error && sorted.length > 0 && (
        <table className="w-full text-start text-sm">
          <thead>
            <tr className="text-slate-400">
              <th className="pb-2">ספק</th>
              <th className="pb-2">סכום</th>
              <th className="pb-2">תדירות</th>
              <th className="pb-2">חיוב אחרון</th>
              <th className="pb-2">סטטוס</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {sorted.map((r, i) => (
              <tr key={i}>
                <td className="py-2 capitalize text-slate-100">{r.merchant}</td>
                <td className="py-2 text-slate-100">{formatILS(r.amount)}</td>
                <td className="py-2 text-slate-300">{FREQUENCY_LABELS[r.frequency] || r.frequency}</td>
                <td className="py-2 text-slate-300">{r.last_charged?.slice(0, 10)}</td>
                <td className="py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      r.status === 'active' ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-slate-200'
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
