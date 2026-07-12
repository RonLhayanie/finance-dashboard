export const FIELD_LABELS = {
  username: 'שם משתמש',
  password: 'סיסמה',
  userCode: 'קוד משתמש',
  id: 'תעודת זהות',
  num: 'קוד מזהה (כולל אותיות וספרות)',
  card6Digits: '6 ספרות אחרונות של הכרטיס',
};

// value must match the provider keys the backend understands (server/src/sync/scraper.js).
// fields must match the library's actual required login fields for that provider.
export const PROVIDERS = [
  { value: 'leumi', label: 'בנק לאומי', fields: ['username', 'password'] },
  { value: 'hapoalim', label: 'בנק הפועלים', fields: ['userCode', 'password'] },
  { value: 'discount', label: 'בנק דיסקונט', fields: ['id', 'num', 'password'] },
  { value: 'max', label: 'מקס (Max)', fields: ['username', 'password'] },
  { value: 'isracard', label: 'ישראכרט', fields: ['id', 'card6Digits', 'password'] },
  { value: 'visaCal', label: 'ויזה כאל (Cal)', fields: ['username', 'password'] },
];

export function getProviderLabel(value) {
  return PROVIDERS.find((p) => p.value === value)?.label || value;
}

export function getProviderFields(value) {
  return PROVIDERS.find((p) => p.value === value)?.fields || ['username', 'password'];
}
