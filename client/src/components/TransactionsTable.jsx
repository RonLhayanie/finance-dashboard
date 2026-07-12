import { useEffect, useState } from 'react';
import { getTransactions } from '../api/client';
import { formatILS } from '../utils/format';
import { CATEGORIES, getCategoryLabel } from '../utils/categories';

const PAGE_SIZE = 20;

export default function TransactionsTable() {
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getTransactions({
      category: category || undefined,
      from: from || undefined,
      to: to || undefined,
      limit: PAGE_SIZE,
      offset,
    })
      .then((data) => {
        if (cancelled) return;
        setRows(data.rows);
        setTotal(data.total);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [category, from, to, offset]);

  function handleFilterChange(setter) {
    return (e) => {
      setter(e.target.value);
      setOffset(0);
    };
  }

  return (
    <div className="rounded-xl bg-slate-800 p-4">
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={category}
          onChange={handleFilterChange(setCategory)}
          className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100"
        >
          <option value="">כל הקטגוריות</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {getCategoryLabel(c)}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={from}
          onChange={handleFilterChange(setFrom)}
          className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100"
        />
        <input
          type="date"
          value={to}
          onChange={handleFilterChange(setTo)}
          className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100"
        />
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      <table className="w-full text-start text-sm">
        <thead>
          <tr className="text-slate-400">
            <th className="pb-2">תאריך</th>
            <th className="pb-2">תיאור</th>
            <th className="pb-2">קטגוריה</th>
            <th className="pb-2">סכום</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {rows.map((r) => (
            <tr key={r.id} className={r.is_anomaly ? 'bg-red-900/30' : ''}>
              <td className="py-2 text-slate-300">{r.date.slice(0, 10)}</td>
              <td className="py-2 text-slate-100">{r.description}</td>
              <td className="py-2 text-slate-300">{getCategoryLabel(r.category || 'other')}</td>
              <td className="py-2 text-slate-100">{formatILS(r.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
        <span>
          {total === 0 ? 0 : offset + 1}-{Math.min(offset + PAGE_SIZE, total)} מתוך {total}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="rounded-lg border border-slate-600 px-3 py-1 disabled:opacity-40"
          >
            הקודם
          </button>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total}
            className="rounded-lg border border-slate-600 px-3 py-1 disabled:opacity-40"
          >
            הבא
          </button>
        </div>
      </div>
    </div>
  );
}
