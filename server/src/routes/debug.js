const express = require('express');
const db = require('../db/db');

// TEMPORARY: remove once the Mizrahi categorization investigation is done.
const router = express.Router();

router.use((req, res, next) => {
  if (process.env.DEBUG_SHOW_TOKENS !== 'true') return res.status(404).json({ error: 'Not found' });
  next();
});

router.get('/account/:accountId/sample', (req, res) => {
  const accountId = Number(req.params.accountId);
  const owned = Number.isInteger(accountId) && db.prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?').get(accountId, req.userId);
  if (!owned) return res.status(404).json({ error: 'Account not found' });

  const recent = db
    .prepare('SELECT description, amount, category FROM transactions WHERE account_id = ? ORDER BY date DESC LIMIT 20')
    .all(accountId);
  const byCategory = db
    .prepare(
      `SELECT category,
              EXISTS (SELECT 1 FROM merchant_categories m WHERE m.merchant = t.description) AS in_ai_cache,
              COUNT(*) AS count,
              ROUND(SUM(amount), 2) AS total
       FROM transactions t WHERE account_id = ?
       GROUP BY category, in_ai_cache ORDER BY count DESC`
    )
    .all(accountId);
  res.json({ recent, byCategory });
});

module.exports = router;
