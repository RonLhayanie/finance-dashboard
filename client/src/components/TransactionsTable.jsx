import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import 'react-day-picker/style.css';
import { getTransactions } from '../api/client';
import { formatILS, formatDay } from '../utils/format';
import { CATEGORIES, getCategoryLabel } from '../utils/categories';

const PAGE_SIZE = 20;

const filterClass =
  'cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-accent)]';

// Same look as filterClass, but a text cursor since these are typed into.
const amountInputClass =
  'w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-accent)]';

// getTransactions expects plain YYYY-MM-DD strings; the picker works in Date
// objects. date-fns' format() reads local date parts directly (unlike
// toISOString, which converts through UTC and can shift the date near
// midnight), so it's the safer choice for this round-trip.
function toISODate(date) {
  return format(date, 'yyyy-MM-dd');
}

function parseISODate(value) {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatRangeLabel(from, to) {
  if (!from && !to) return 'בחר טווח תאריכים';
  const label = (v) => format(parseISODate(v), 'dd/MM/yyyy');
  if (from && to) return `${label(from)} - ${label(to)}`;
  return label(from || to);
}

// Overrides react-day-picker's CSS custom properties to the app's tokens.
// White text on the range-endpoint/selected dates matches how the rest of
// the app labels accent-colored surfaces (e.g. the active nav link, the
// login submit button) - there's no dedicated token for it.
const dayPickerStyle = {
  color: 'var(--color-text)',
  '--rdp-accent-color': 'var(--color-accent)',
  '--rdp-accent-background-color': 'var(--color-surface-2)',
  '--rdp-today-color': 'var(--color-accent)',
  '--rdp-range_middle-color': 'var(--color-text)',
  '--rdp-range_start-color': 'white',
  '--rdp-range_end-color': 'white',
};

export default function TransactionsTable() {
  const [searchParams, setSearchParams] = useSearchParams();
  // category lives in the URL (?category=), not local state - lets other
  // pages deep-link into a pre-filtered view (e.g. the spending donut).
  // An unrecognized/stale value falls back to "all", same guard pattern
  // used for the dashboard's account filter.
  const rawCategoryParam = searchParams.get('category') || '';
  const category = rawCategoryParam === '' || CATEGORIES.includes(rawCategoryParam) ? rawCategoryParam : '';
  // Same URL-as-source-of-truth pattern as category - composes with it and
  // with from/to since all four are independent params ANDed together by
  // the backend.
  const anomalyOnly = searchParams.get('anomaly') === '1';
  // Also URL-driven; raw strings are passed through and the backend
  // ignores anything that isn't a non-negative number.
  const minAmount = searchParams.get('minAmount') || '';
  const maxAmount = searchParams.get('maxAmount') || '';
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTransactions({
      category: category || undefined,
      from: from || undefined,
      to: to || undefined,
      anomaly: anomalyOnly ? 1 : undefined,
      minAmount: minAmount || undefined,
      maxAmount: maxAmount || undefined,
      limit: PAGE_SIZE,
      offset,
    })
      .then((data) => {
        if (cancelled) return;
        setRows(data.rows);
        setTotal(data.total);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [category, from, to, anomalyOnly, minAmount, maxAmount, offset]);

  useEffect(() => {
    if (!pickerOpen) return;
    function handleClickOutside(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setPickerOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [pickerOpen]);

  function handleCategoryChange(e) {
    const value = e.target.value;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) {
        next.set('category', value);
      } else {
        next.delete('category');
      }
      return next;
    });
    setOffset(0);
  }

  function handleAnomalyChange(e) {
    const checked = e.target.checked;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (checked) {
        next.set('anomaly', '1');
      } else {
        next.delete('anomaly');
      }
      return next;
    });
    setOffset(0);
  }

  function handleRangeSelect(range) {
    // react-day-picker's range mode sets from=to on the first click (a
    // zero-length range) and only extends `to` on a second, later click -
    // so there's no reliable "range just completed" signal here to
    // auto-close on. Left open until the user dismisses it themselves
    // (toggle button, outside click, or Escape).
    setFrom(range?.from ? toISODate(range.from) : '');
    setTo(range?.to ? toISODate(range.to) : '');
    setOffset(0);
  }

  // replace: true so typing doesn't push a history entry per keystroke.
  function handleAmountChange(key) {
    return (e) => {
      const value = e.target.value;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) {
            next.set(key, value);
          } else {
            next.delete(key);
          }
          return next;
        },
        { replace: true }
      );
      setOffset(0);
    };
  }

  function clearRangeFilters() {
    setFrom('');
    setTo('');
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('minAmount');
      next.delete('maxAmount');
      return next;
    });
    setOffset(0);
    setPickerOpen(false);
  }

  return (
    <div className="rounded-xl bg-[var(--color-surface)] p-4">
      {/* Scoped to this component's own picker instance only. */}
      <style>{`
        .app-daypicker .rdp-day_button:hover:not(:disabled) {
          background-color: var(--color-surface-2);
        }
      `}</style>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <select value={category} onChange={handleCategoryChange} className={filterClass}>
          <option value="">כל הקטגוריות</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {getCategoryLabel(c)}
            </option>
          ))}
        </select>

        <div className="relative flex flex-col gap-1" ref={pickerRef}>
          <span className="text-xs text-[var(--color-text-muted)]">טווח תאריכים</span>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className={`${filterClass} text-start`}
          >
            {from || to ? (
              // Forced LTR: without it, the RTL bidi algorithm reorders the
              // two "dd/mm/yyyy" chunks around the " - " separator, so a
              // 10/09 -> 20/09 range visually displays as 20/09 - 10/09.
              // Only applied here, not to the Hebrew placeholder below.
              <span dir="ltr">{formatRangeLabel(from, to)}</span>
            ) : (
              formatRangeLabel(from, to)
            )}
          </button>

          {pickerOpen && (
            <div
              className="absolute top-full right-0 z-20 mt-2 rounded-xl border p-3 shadow-2xl"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <DayPicker
                mode="range"
                dir="rtl"
                locale={he}
                selected={{ from: parseISODate(from), to: parseISODate(to) }}
                onSelect={handleRangeSelect}
                className="app-daypicker"
                style={dayPickerStyle}
              />
            </div>
          )}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--color-text-muted)]">מסכום</span>
          <input
            type="number"
            min="0"
            inputMode="decimal"
            value={minAmount}
            onChange={handleAmountChange('minAmount')}
            className={amountInputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--color-text-muted)]">עד סכום</span>
          <input
            type="number"
            min="0"
            inputMode="decimal"
            value={maxAmount}
            onChange={handleAmountChange('maxAmount')}
            className={amountInputClass}
          />
        </label>

        {(from || to || minAmount || maxAmount) && (
          <button
            type="button"
            onClick={clearRangeFilters}
            className="cursor-pointer rounded-lg bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-border)] hover:text-[var(--color-text)]"
          >
            נקה
          </button>
        )}

        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text-muted)]">
          <input
            type="checkbox"
            checked={anomalyOnly}
            onChange={handleAnomalyChange}
            className="cursor-pointer accent-[var(--color-accent)]"
          />
          הצג רק חריגות
        </label>
      </div>

      {error && <p className="mb-3 text-sm text-[var(--color-expense)]">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">לא נמצאו תנועות</p>
      ) : (
        <table className="w-full text-start text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)]">
              <th className="pb-2 text-start font-medium">תאריך</th>
              <th className="pb-2 text-start font-medium">תיאור</th>
              <th className="pb-2 text-start font-medium">קטגוריה</th>
              <th className="pb-2 text-start font-medium">סכום</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={`border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-surface-2)] ${
                  r.is_anomaly ? 'bg-[var(--color-warning-bg)]' : ''
                }`}
              >
                <td className="py-2 text-[var(--color-text-muted)]">{formatDay(r.date)}</td>
                <td className="py-2 text-[var(--color-text)]">
                  <span className="flex items-center gap-2">
                    {r.description}
                    {r.is_anomaly ? (
                      <span className="inline-block shrink-0 rounded-full bg-[var(--color-warning-bg)] px-2 py-0.5 text-xs text-[var(--color-warning)]">
                        חריגה
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="py-2">
                  <span className="inline-block rounded-full bg-[var(--color-surface-2)] px-2.5 py-0.5 text-xs text-[var(--color-text-muted)]">
                    {getCategoryLabel(r.category || 'other')}
                  </span>
                </td>
                <td
                  className="py-2 font-medium"
                  style={{ color: r.amount < 0 ? 'var(--color-expense)' : 'var(--color-income)' }}
                >
                  {formatILS(r.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-[var(--color-text-muted)]">
        <span>
          {total === 0 ? 0 : offset + 1}-{Math.min(offset + PAGE_SIZE, total)} מתוך {total}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="cursor-pointer rounded-lg bg-[var(--color-surface-2)] px-3 py-1 text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            הקודם
          </button>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total}
            className="cursor-pointer rounded-lg bg-[var(--color-surface-2)] px-3 py-1 text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            הבא
          </button>
        </div>
      </div>
    </div>
  );
}
