// Usage: node scripts/recategorize-mizrahi.js <accountId>
// One-off: re-applies the Mizrahi debit-purchase / branch-activity rules to one
// account's existing rows, and removes the bad shared AI-cache entries for
// those two descriptions. Other accounts' rows are not touched.
require('dotenv').config();
const db = require('../src/db/db');
const { categorize } = require('../src/analytics/categorize');

const accountId = Number(process.argv[2]);
if (!Number.isInteger(accountId)) {
  console.error('Usage: node scripts/recategorize-mizrahi.js <accountId>');
  process.exit(1);
}

const PHRASES = ['רכישה בכרטיס דביט', 'פעילות בקופת סניף'];
const totals = () =>
  db.prepare('SELECT category, COUNT(*) AS n, ROUND(SUM(amount), 2) AS total FROM transactions WHERE account_id = ? GROUP BY category ORDER BY n DESC').all(accountId);

console.log('Before:');
console.table(totals());

const update = db.prepare('UPDATE transactions SET category = ? WHERE account_id = ? AND description = ?');
const dropCache = db.prepare('DELETE FROM merchant_categories WHERE merchant = ?');
db.transaction(() => {
  for (const p of PHRASES) {
    const { changes } = update.run(categorize(p, db), accountId, p);
    const cache = dropCache.run(p).changes;
    console.log(`${p}: ${changes} rows updated, ${cache} cache entries removed`);
  }
})();

console.log('After:');
console.table(totals());
