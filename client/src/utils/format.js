const currencyFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 2,
});

export function formatILS(amount) {
  return currencyFormatter.format(amount || 0);
}
