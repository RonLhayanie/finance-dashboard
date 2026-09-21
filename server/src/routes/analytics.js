const express = require('express');
const db = require('../db/db');
const { categorizeAll } = require('../analytics/categorize');
const { detectSubscriptions } = require('../analytics/subscriptions');
const { detectAnomalies } = require('../analytics/anomalies');
const { get_spending_summary, get_anomalies } = require('../ai/tools');

const router = express.Router();

// account_id is optional everywhere below and always additive on top of the
// user_id scope, never a replacement for it - an account_id that isn't
// owned by req.userId is excluded by the user_id subquery each query still
// carries, so it never needs a separate ownership error, just an empty result.
function parseAccountId(value) {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n)) {
    throw new Error('account_id must be an integer');
  }
  return n;
}

router.get('/summary', (req, res) => {
  const { from, to, groupBy } = req.query;
  try {
    const accountId = parseAccountId(req.query.account_id);
    res.json(get_spending_summary({ from, to, groupBy, accountId, userId: req.userId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/anomalies', (req, res) => {
  const { from, to } = req.query;
  const limit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
  try {
    const accountId = parseAccountId(req.query.account_id);
    res.json(get_anomalies({ from, to, limit, accountId, userId: req.userId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Income vs. expense per month, for the dashboard trend chart, scoped to
// the caller's own accounts (optionally narrowed to one of them).
router.get('/monthly', (req, res) => {
  let accountId;
  try {
    accountId = parseAccountId(req.query.account_id);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const clauses = [
    'account_id IN (SELECT id FROM accounts WHERE user_id = ?)',
    "(category IS NULL OR category NOT IN ('card_payment', 'internal'))",
  ];
  const params = [req.userId];
  if (accountId !== undefined) {
    clauses.push('account_id = ?');
    params.push(accountId);
  }

  const rows = db
    .prepare(
      `SELECT strftime('%Y-%m', date) AS month,
              SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,
              SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS expense
       FROM transactions
       WHERE ${clauses.join(' AND ')}
       GROUP BY month
       ORDER BY month`
    )
    .all(...params);
  res.json(rows);
});

// Distinct months (YYYY-MM) that have transaction data, for the frontend's
// month picker. Scoped to the caller's own accounts only.
router.get('/months', (req, res) => {
  const rows = db
    .prepare(
      `SELECT DISTINCT strftime('%Y-%m', date) AS month
       FROM transactions
       WHERE account_id IN (SELECT id FROM accounts WHERE user_id = ?)
       ORDER BY month`
    )
    .all(req.userId);
  res.json(rows.map((r) => r.month));
});

router.get('/insight', (req, res) => {
  const row = db
    .prepare('SELECT text, generated_at FROM insights WHERE user_id = ? ORDER BY id DESC LIMIT 1')
    .get(req.userId);
  res.json(row || { text: null });
});

router.post('/recompute', (req, res) => {
  const categorized = categorizeAll(db, req.userId);
  const subscriptionsTouched = detectSubscriptions(db, req.userId);
  const anomaliesFlagged = detectAnomalies(db, req.userId);
  res.json({ categorized, subscriptionsTouched, anomaliesFlagged });
});

module.exports = router;
