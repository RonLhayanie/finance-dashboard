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
    res.json(get_spending_summary({ from, to, groupBy }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/anomalies', (req, res) => {
  const limit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
  try {
    res.json(get_anomalies({ limit }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Income vs. expense per month, for the dashboard trend chart. No user input
// in the query, so it needs no validation.
router.get('/monthly', (req, res) => {
  const rows = db
    .prepare(
      `SELECT strftime('%Y-%m', date) AS month,
              SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,
              SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS expense
       FROM transactions
       GROUP BY month
       ORDER BY month`
    )
    .all();
  res.json(rows);
});

router.post('/recompute', (req, res) => {
  const categorized = categorizeAll(db);
  const subscriptionsTouched = detectSubscriptions(db);
  const anomaliesFlagged = detectAnomalies(db);
  res.json({ categorized, subscriptionsTouched, anomaliesFlagged });
});

module.exports = router;
