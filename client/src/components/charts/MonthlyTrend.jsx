import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from 'recharts';
import { getMonthlyBreakdown } from '../../api/client';
import { formatILS } from '../../utils/format';
import { INCOME_COLOR, EXPENSE_COLOR, GRID_COLOR, AXIS_TEXT_COLOR, TOOLTIP_BG, TOOLTIP_BORDER } from '../../utils/chartColors';

const SERIES_LABELS = { income: 'הכנסות', expense: 'הוצאות' };

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-sm shadow-xl"
      style={{ backgroundColor: TOOLTIP_BG, borderColor: TOOLTIP_BORDER }}
    >
      <p className="mb-1 text-xs text-slate-400">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center gap-2 text-slate-100">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-400">{SERIES_LABELS[entry.dataKey]}:</span>
          <span className="font-semibold">{formatILS(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

export default function MonthlyTrend() {
  const [data, setData] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getMonthlyBreakdown()
      .then((rows) => {
        if (cancelled) return;
        setData(rows.slice(-12));
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800 p-5 shadow-lg">
      <h3 className="mb-4 text-sm font-medium text-slate-300">הכנסות מול הוצאות (12 חודשים אחרונים)</h3>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!error && data.length === 0 && <p className="text-sm text-slate-400">אין עדיין היסטוריית תנועות.</p>}
      {!error && data.length > 0 && (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} barGap={2} barCategoryGap="24%">
            <CartesianGrid strokeDasharray="0" stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="month" stroke={AXIS_TEXT_COLOR} fontSize={12} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
            <YAxis
              stroke={AXIS_TEXT_COLOR}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => new Intl.NumberFormat('he-IL').format(v)}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
            <Legend
              formatter={(value) => <span className="text-slate-300">{SERIES_LABELS[value]}</span>}
              iconType="circle"
            />
            <Bar dataKey="income" name="income" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="expense" name="expense" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
