const { createAdapter } = require('../ai/adapter');

// Lazy + cached, same pattern as ai/chat.js and analytics/aiCategorize.js - a
// missing/bad LLM_PROVIDER config must not crash the sync, only skip insight
// generation.
let cachedAdapter = null;
function getAdapter() {
  if (!cachedAdapter) {
    cachedAdapter = createAdapter();
  }
  return cachedAdapter;
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

// card_payment/internal are internal bookkeeping categories, excluded from
// spending analytics everywhere else in this codebase - same here.
const EXCLUDE_INTERNAL = "(category IS NULL OR category NOT IN ('card_payment', 'internal'))";

// Every query below is scoped to userId's own accounts via this subquery -
// generateInsight is called once per synced account (see sync/engine.js),
// always with that account's owner's userId, so the resulting insight only
// ever describes one user's own spending.
const OWNED_ACCOUNTS = 'account_id IN (SELECT id FROM accounts WHERE user_id = ?)';

function categoryBreakdown(db, userId, fromDate, toDate) {
  return db
    .prepare(
      `SELECT COALESCE(cl.label_he, t.category, 'אחר') AS label, SUM(-t.amount) AS total, COUNT(*) AS n
       FROM transactions t
       LEFT JOIN category_labels cl ON cl.slug = t.category
       WHERE t.amount < 0 AND t.date >= ? AND t.date <= ? AND ${EXCLUDE_INTERNAL}
         AND t.${OWNED_ACCOUNTS}
       GROUP BY t.category
       ORDER BY total DESC`
    )
    .all(toISODate(fromDate), toISODate(toDate), userId);
}

// Compact summary only - aggregated numbers and a handful of labels, never
// raw transaction dumps, to keep the prompt short.
function buildSummary(db, userId) {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const currentCategories = categoryBreakdown(db, userId, currentMonthStart, now);
  const previousCategories = categoryBreakdown(db, userId, prevMonthStart, prevMonthEnd);

  const currentTotal = currentCategories.reduce((s, r) => s + r.total, 0);
  const previousTotal = previousCategories.reduce((s, r) => s + r.total, 0);

  const sixMonthRows = db
    .prepare(
      `SELECT strftime('%Y-%m', date) AS month, SUM(-amount) AS total
       FROM transactions
       WHERE amount < 0 AND date >= ? AND ${EXCLUDE_INTERNAL} AND ${OWNED_ACCOUNTS}
       GROUP BY month`
    )
    .all(toISODate(sixMonthsAgo), userId);
  const sixMonthAvgExpense = sixMonthRows.length
    ? sixMonthRows.reduce((s, r) => s + r.total, 0) / sixMonthRows.length
    : 0;

  const anomalyCount = db
    .prepare(`SELECT COUNT(*) AS n FROM transactions WHERE is_anomaly = 1 AND date >= ? AND date <= ? AND ${OWNED_ACCOUNTS}`)
    .get(toISODate(currentMonthStart), toISODate(now), userId).n;
  const topAnomalies = db
    .prepare(
      `SELECT description, amount, date FROM transactions
       WHERE is_anomaly = 1 AND date >= ? AND date <= ? AND ${OWNED_ACCOUNTS}
       ORDER BY ABS(amount) DESC LIMIT 3`
    )
    .all(toISODate(currentMonthStart), toISODate(now), userId);

  const subs = db
    .prepare(`SELECT COUNT(*) AS n, SUM(amount) AS total FROM subscriptions WHERE status = 'active' AND ${OWNED_ACCOUNTS}`)
    .get(userId);

  return {
    currentMonth: {
      total: Math.round(currentTotal),
      byCategory: currentCategories.slice(0, 8).map((r) => ({ category: r.label, total: Math.round(r.total) })),
    },
    previousMonth: {
      total: Math.round(previousTotal),
      byCategory: previousCategories.slice(0, 8).map((r) => ({ category: r.label, total: Math.round(r.total) })),
    },
    sixMonthAvgExpense: Math.round(sixMonthAvgExpense),
    anomalies: {
      count: anomalyCount,
      top: topAnomalies.map((a) => ({ description: a.description, amount: Math.round(Math.abs(a.amount)), date: a.date.slice(0, 10) })),
    },
    activeSubscriptions: { count: subs.n || 0, monthlyTotal: Math.round(subs.total || 0) },
  };
}

const SYSTEM_PROMPT =
  'You are a financial advisor. Given this monthly summary, write ONE sharp, ' +
  "specific insight (1-2 sentences) in Hebrew about the user's spending this month " +
  '- a notable change, a trend, or something worth their attention. Be concrete ' +
  '(name the category, the number). Not generic. No greeting, no markdown, just the ' +
  'insight sentence.';

async function generateInsight(db, userId, adapter) {
  if (!Number.isInteger(userId)) {
    console.error('generateInsight: userId is required, skipping');
    return null;
  }

  let activeAdapter;
  try {
    activeAdapter = adapter || getAdapter();
  } catch (err) {
    console.error('generateInsight: adapter unavailable, skipping:', err.message);
    return null;
  }

  let summary;
  try {
    summary = buildSummary(db, userId);
  } catch (err) {
    console.error('generateInsight: failed to build summary, skipping:', err.message);
    return null;
  }

  let result;
  try {
    result = await activeAdapter.complete({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(summary) }],
      tools: [],
    });
  } catch (err) {
    console.error('generateInsight: AI call failed, skipping:', err.message);
    return null;
  }

  if (!result || result.type !== 'text' || !result.text || !result.text.trim()) {
    console.error('generateInsight: unexpected or empty AI response, skipping');
    return null;
  }

  const text = result.text.trim();

  try {
    db.prepare("INSERT INTO insights (user_id, text, generated_at) VALUES (?, ?, datetime('now'))").run(userId, text);
  } catch (err) {
    console.error('generateInsight: failed to persist insight:', err.message);
    return null;
  }

  return text;
}

module.exports = { generateInsight };
