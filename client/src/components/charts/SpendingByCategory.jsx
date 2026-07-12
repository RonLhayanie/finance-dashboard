import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getSummary } from '../../api/client';
import { formatILS } from '../../utils/format';
import { getCategoryLabel } from '../../utils/categories';
import { getCategoryColor, OTHER_COLOR, TOOLTIP_BG, TOOLTIP_BORDER } from '../../utils/chartColors';

const MAX_SLICES = 6;

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div
      className="rounded-lg border px-3 py-2 text-sm shadow-xl"
      style={{ backgroundColor: TOOLTIP_BG, borderColor: TOOLTIP_BORDER }}
    >
      <p className="flex items-center gap-2 text-slate-100">
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entry.payload.color }} />
        <span className="text-slate-400">{entry.name}:</span>
        <span className="font-semibold">{formatILS(entry.value)}</span>
      </p>
    </div>
  );
}

export default function SpendingByCategory({ from, to }) {
  const [data, setData] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getSummary({ from, to, groupBy: 'category' })
      .then((rows) => {
        if (cancelled) return;
        const spend = rows
          .filter((r) => r.total < 0)
          .map((r) => ({ key: r.group_key, value: Math.abs(r.total) }))
          .sort((a, b) => b.value - a.value);

        const primary = spend.slice(0, MAX_SLICES);
        const rest = spend.slice(MAX_SLICES);
        const otherTotal = rest.reduce((sum, r) => sum + r.value, 0);

        const chartData = primary.map((r) => ({
          name: getCategoryLabel(r.key),
          value: r.value,
          color: getCategoryColor(r.key),
        }));
        if (otherTotal > 0) {
          chartData.push({ name: 'אחר', value: otherTotal, color: OTHER_COLOR });
        }
        setData(chartData);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800 p-5 shadow-lg">
      <h3 className="mb-4 text-sm font-medium text-slate-300">הוצאות לפי קטגוריה</h3>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!error && data.length === 0 && <p className="text-sm text-slate-400">אין נתוני הוצאות לתקופה זו.</p>}
      {!error && data.length > 0 && (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2} stroke="none">
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              formatter={(value) => <span className="text-slate-300">{value}</span>}
              iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
