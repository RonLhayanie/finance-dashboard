const express = require('express');
const db = require('../db/db');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const router = express.Router();

function getValidCategorySlugs() {
  return db.prepare('SELECT slug FROM category_labels').all().map((r) => r.slug);
}

router.get('/', (req, res) => {
  const { from, to, category } = req.query;

  if (from !== undefined && !DATE_RE.test(from)) {
    return res.status(400).json({ error: 'from must match YYYY-MM-DD' });
  }
  if (to !== undefined && !DATE_RE.test(to)) {
    return res.status(400).json({ error: 'to must match YYYY-MM-DD' });
  }
  if (category !== undefined) {
    const validSlugs = getValidCategorySlugs();
    if (!validSlugs.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${validSlugs.join(', ')}` });
    }
  }

  const limit = Math.min(200, Math.max(1, Number.isInteger(Number(req.query.limit)) ? Number(req.query.limit) : 50));
  const offset = Math.max(0, Number.isInteger(Number(req.query.offset)) ? Number(req.query.offset) : 0);

  const clauses = ['account_id IN (SELECT id FROM accounts WHERE user_id = ?)'];
  const params = [req.userId];
  if (from !== undefined) {
    clauses.push('date >= ?');
    params.push(from);
  }
  if (to !== undefined) {
    clauses.push('date <= ?');
    params.push(to);
  }
  if (category !== undefined) {
    clauses.push('category = ?');
    params.push(category);
  } else {
    clauses.push("(category IS NULL OR category NOT IN ('card_payment', 'internal'))");
  }
  const where = `WHERE ${clauses.join(' AND ')}`;

  const rows = db
    .prepare(
      `SELECT id, date, amount, currency, description, category, is_anomaly
       FROM transactions ${where} ORDER BY date DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  const { count } = db
    .prepare(`SELECT COUNT(*) AS count FROM transactions ${where}`)
    .get(...params);

  res.json({ rows, total: count, limit, offset });
});

module.exports = router;
