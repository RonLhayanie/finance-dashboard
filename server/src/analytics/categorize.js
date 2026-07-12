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

function categorize(description) {
  const text = (description || '').toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      return rule.category;
    }
  }
  return 'other';
}

function categorizeAll(db) {
  const rows = db.prepare('SELECT id, description FROM transactions WHERE category IS NULL').all();
  const update = db.prepare('UPDATE transactions SET category = ? WHERE id = ?');

  const applyAll = db.transaction((rows_) => {
    for (const row of rows_) {
      update.run(categorize(row.description), row.id);
    }
  });
  applyAll(rows);

  return rows.length;
}

module.exports = { CATEGORIES, categorize, categorizeAll };
