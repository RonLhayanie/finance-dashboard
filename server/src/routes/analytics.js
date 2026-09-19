const express = require('express');
const db = require('../db/db');
const { categorizeAll } = require('../analytics/categorize');
const { detectSubscriptions } = require('../analytics/subscriptions');
const { detectAnomalies } = require('../analytics/anomalies');
const { get_spending_summary, get_anomalies } = require('../ai/tools');

const router = express.Router();

router.get('/summary', (req, res) => {
  const { from, to, groupBy } = req.query;
  try {
    res.json(get_spending_summary({ from, to, groupBy, userId: req.userId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/anomalies', (req, res) => {
  const limit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
  try {
    res.json(get_anomalies({ limit, userId: req.userId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Income vs. expense per month, for the dashboard trend chart, scoped to
// the caller's own accounts.
router.get('/monthly', (req, res) => {
  const rows = db
    .prepare(
      `SELECT strftime('%Y-%m', date) AS month,
              SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,
              SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS expense
       FROM transactions
       WHERE account_id IN (SELECT id FROM accounts WHERE user_id = ?)
         AND (category IS NULL OR category NOT IN ('card_payment', 'internal'))
       GROUP BY month
       ORDER BY month`
    )
    .all(req.userId);
  res.json(rows);
});

// TODO(multi-tenancy): the insights table has no account/user linkage - it
// holds a single global row generated from ALL users' transactions
// (analytics/generateInsight.js), so this endpoint currently returns the
// same insight to every user regardless of whose spending it describes.
// Fixing it needs a schema change (insight ownership) and a change to how/
// when generateInsight runs post-sync, which is out of this pass's
// authorized scope (only accounts.user_id was authorized). Flagged here
// deliberately rather than left silently unscoped.
router.get('/insight', (req, res) => {
  const row = db.prepare('SELECT text, generated_at FROM insights ORDER BY id DESC LIMIT 1').get();
  res.json(row || { text: null });
});

router.post('/recompute', (req, res) => {
  const accountIds = db.prepare('SELECT id FROM accounts WHERE user_id = ?').all(req.userId).map((r) => r.id);
  const categorized = categorizeAll(db, accountIds);
  const subscriptionsTouched = detectSubscriptions(db, accountIds);
  const anomaliesFlagged = detectAnomalies(db, accountIds);
  res.json({ categorized, subscriptionsTouched, anomaliesFlagged });
});

module.exports = router;
