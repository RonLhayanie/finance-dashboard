import { format } from 'date-fns';

const currencyFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 2,
});

export function formatILS(amount) {
  return currencyFormatter.format(amount || 0);
}

// Transaction dates are stored as UTC timestamps; show the Israel-local day
// (what the server's date(date, 'localtime') filters and groups on), not the UTC one.
export function formatDay(isoTimestamp) {
  return format(new Date(isoTimestamp), 'yyyy-MM-dd');
}
