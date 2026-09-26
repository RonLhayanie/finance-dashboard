import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getSummary } from '../../api/client';
import { formatILS } from '../../utils/format';
import { getCategoryLabel } from '../../utils/categories';
import { TOOLTIP_BG, TOOLTIP_BORDER } from '../../utils/chartColors';

const MAX_SLICES = 6;

// Fixed, distinct palette assigned by slice index so categories are always
// readable against the dark background. The long-tail bucket always stays neutral gray.
// It is labeled "קטגוריות נוספות", not "אחר", so it never collides with the real
// `other` category when that one ranks in the top MAX_SLICES.
const DONUT_PALETTE = ['#7F77DD', '#1baf7a', '#378ADD', '#EF9F27', '#e2534a', '#e87ba4', '#5DCAA5', '#BA7517'];
const OTHER_GRAY = '#888780';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div
      className="rounded-lg border px-3 py-2 text-sm shadow-xl"
      style={{ backgroundColor: TOOLTIP_BG, borderColor: TOOLTIP_BORDER }}
    >
      <p className="flex items-center gap-2 text-[var(--color-text)]">
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entry.payload.color }} />
        <span className="text-[var(--color-text-muted)]">{entry.name}:</span>
        <span className="font-semibold">{formatILS(entry.value)}</span>
      </p>
    </div>
  );
}

export default function SpendingByCategory({ from, to, accountId }) {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [error, setError] = useState('');

  function goToCategory(slug) {
    if (slug) navigate(`/transactions?category=${slug}`);
  }

  useEffect(() => {
    let cancelled = false;
    getSummary({ from, to, groupBy: 'category', account_id: accountId })
      .then((rows) => {
        if (cancelled) return;
        const spend = rows
          .filter((r) => r.total < 0)
          .map((r) => ({ key: r.group_key, value: Math.abs(r.total) }))
          .sort((a, b) => b.value - a.value);

        const primary = spend.slice(0, MAX_SLICES);
        const rest = spend.slice(MAX_SLICES);
        const otherTotal = rest.reduce((sum, r) => sum + r.value, 0);

        const chartData = primary.map((r, i) => ({
          name: getCategoryLabel(r.key),
          value: r.value,
          color: DONUT_PALETTE[i % DONUT_PALETTE.length],
          slug: r.key,
        }));
        if (otherTotal > 0) {
          // This bucket aggregates several long-tail categories beyond MAX_SLICES -
          // there's no single category slug it can deep-link to, so it has
          // no slug and stays non-clickable below.
          chartData.push({ name: 'קטגוריות נוספות', value: otherTotal, color: OTHER_GRAY });
        }
        setData(chartData);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [from, to, accountId]);

  return (
    <div>
      <h3 className="mb-4 text-sm font-medium text-[var(--color-text-muted)]">הוצאות לפי קטגוריה</h3>
      {error && <p className="text-sm text-[var(--color-expense)]">{error}</p>}
      {!error && data.length === 0 && <p className="text-sm text-[var(--color-text-dim)]">אין נתוני הוצאות לתקופה זו.</p>}
      {!error && data.length > 0 && (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2} stroke="none">
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.color}
                  cursor={entry.slug ? 'pointer' : 'default'}
                  onClick={() => goToCategory(entry.slug)}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              onClick={(entry) => goToCategory(entry?.payload?.slug)}
              formatter={(value, entry) => (
                <span
                  className={
                    entry?.payload?.slug
                      ? 'cursor-pointer text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]'
                      : 'text-[var(--color-text-muted)]'
                  }
                >
                  {value}
                </span>
              )}
              iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
