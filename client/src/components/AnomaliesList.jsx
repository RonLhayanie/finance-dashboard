import { useEffect, useState } from 'react';
import { getAnomalies } from '../api/client';
import { formatILS } from '../utils/format';
import { getCategoryLabel } from '../utils/categories';
import { getCategoryColor } from '../utils/chartColors';

export default function AnomaliesList() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getAnomalies()
      .then((data) => !cancelled && setRows(data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800 p-5 shadow-lg">
      <h3 className="mb-4 text-sm font-medium text-slate-300">חריגות</h3>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!error && rows.length === 0 && <p className="text-sm text-slate-400">לא זוהו חריגות.</p>}
      {!error && rows.length > 0 && (
        <ul className="divide-y divide-slate-700/70">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm text-slate-100">{r.description}</p>
                <p className="text-xs text-slate-400">{r.date.slice(0, 10)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full bg-slate-700/70 px-2.5 py-1 text-xs text-slate-300">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: getCategoryColor(r.category) }}
                  />
                  {getCategoryLabel(r.category)}
                </span>
                <span className="text-sm font-medium text-slate-100">{formatILS(r.amount)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
