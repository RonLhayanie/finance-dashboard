export const CATEGORIES = [
  'groceries',
  'restaurants',
  'transport',
  'fuel',
  'utilities',
  'telecom',
  'insurance',
  'health',
  'entertainment',
  'shopping',
  'subscriptions',
  'salary',
  'transfers',
  'fees',
  'cash',
  'other',
];

const CATEGORY_LABELS = {
  groceries: 'מכולת',
  restaurants: 'מסעדות',
  transport: 'תחבורה',
  fuel: 'דלק',
  utilities: 'שירותים',
  telecom: 'תקשורת',
  insurance: 'ביטוח',
  health: 'בריאות',
  entertainment: 'בידור',
  shopping: 'קניות',
  subscriptions: 'מנויים',
  salary: 'משכורת',
  transfers: 'העברות',
  fees: 'עמלות',
  cash: 'מזומן',
  other: 'אחר',
};

export function getCategoryLabel(value) {
  return CATEGORY_LABELS[value] || value;
}
