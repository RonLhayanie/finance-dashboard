const CATEGORIES = [
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
  'card_payment',
  'internal',
];

// Starter keyword set for common Israeli merchants (Hebrew + English). Accuracy
// will be tuned later; the rule structure and category taxonomy are what matter now.
const RULES = [
  {
    category: 'groceries',
    keywords: [
      'שופרסל', 'רמי לוי', 'ויקטורי', 'יוחננוף', 'יינות ביתן', 'מגה בעש',
      'קואופ', 'חצי חינם', 'טיב טעם', 'אושר עד',
    ],
  },
  {
    category: 'fuel',
    keywords: [
      'פז', 'סונול', 'דלק', 'yellow', 'דור אלון', 'טן חן', 'alonit', 'sonol',
    ],
  },
  {
    category: 'transport',
    keywords: [
      'רב קו', 'gett', 'מונית', 'רכבת ישראל', 'אגד', 'uber', 'bolt', 'מטרונית', 'קווים',
    ],
  },
  {
    category: 'telecom',
    keywords: [
      'פלאפון', 'סלקום', 'פרטנר', 'הוט', 'bezeq', 'בזק', 'גולן טלקום', 'רמי לוי תקשורת', 'we',
    ],
  },
  {
    category: 'restaurants',
    keywords: [
      'וולט', 'wolt', 'מקדונלד', 'קפה', 'ארומה', 'קפה קפה', 'פיצה', 'בורגר', 'תן ביס', 'גרג',
    ],
  },
  {
    category: 'utilities',
    keywords: ['חברת חשמל', 'עיריית', 'ארנונה', 'תאגיד המים', 'מי אביבים'],
  },
  {
    category: 'insurance',
    keywords: ['הראל', 'כלל ביטוח', 'מגדל', 'הפניקס', 'ביטוח לאומי'],
  },
  {
    category: 'health',
    keywords: ['קופת חולים', 'כללית', 'מכבי', 'לאומית', 'בית מרקחת', 'סופר פארם'],
  },
  {
    category: 'entertainment',
    keywords: ['נטפליקס', 'netflix', 'spotify', 'ספוטיפיי', 'סינמה סיטי', 'yes', 'כאן'],
  },
  {
    category: 'shopping',
    keywords: ['amazon', 'אמזון', 'aliexpress', 'זארה', 'קסטרו', 'שילב', 'ebay'],
  },
  {
    category: 'subscriptions',
    keywords: ['disney', 'youtube premium', 'icloud', 'office 365', 'chatgpt'],
  },
  {
    category: 'salary',
    keywords: ['משכורת', 'שכר', 'payroll'],
  },
  {
    category: 'transfers',
    keywords: ['העברה', 'ביט', 'bit', 'paybox'],
  },
  {
    category: 'fees',
    keywords: ['עמלה', 'דמי ניהול', 'ריבית'],
  },
  {
    category: 'cash',
    keywords: ['משיכת מזומן', 'כספומט'],
  },
];

function categorize(description, db) {
  const m = (description || '').match(/חיוב לכרטיס ויזה\s*(\d{4})/);
  if (m && db) {
    const last4 = m[1];
    const mapping = db.prepare('SELECT account_id FROM card_mappings WHERE last4 = ?').get(last4);
    if (mapping) {
      return 'card_payment';
    }
  }

  const text = (description || '').toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      return rule.category;
    }
  }
  return 'other';
}

// accountIds, when given, scopes categorization to that set of accounts
// (used by the per-user /recompute route). Omitted entirely, it processes
// every account - the existing behavior the post-sync hook in sync/engine.js
// still relies on.
function categorizeAll(db, accountIds) {
  const scoped = Array.isArray(accountIds);
  if (scoped && accountIds.length === 0) return 0;

  const where = scoped
    ? `WHERE category IS NULL AND account_id IN (${accountIds.map(() => '?').join(',')})`
    : 'WHERE category IS NULL';
  const rows = db.prepare(`SELECT id, description FROM transactions ${where}`).all(...(scoped ? accountIds : []));
  const update = db.prepare('UPDATE transactions SET category = ? WHERE id = ?');

  const applyAll = db.transaction((rows_) => {
    for (const row of rows_) {
      update.run(categorize(row.description, db), row.id);
    }
  });
  applyAll(rows);

  return rows.length;
}

module.exports = { CATEGORIES, categorize, categorizeAll };
