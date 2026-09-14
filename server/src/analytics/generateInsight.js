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

function categoryBreakdown(db, fromDate, toDate) {
  return db
    .prepare(
      `SELECT COALESCE(cl.label_he, t.category, 'אחר') AS label, SUM(-t.amount) AS total, COUNT(*) AS n
       FROM transactions t
       LEFT JOIN category_labels cl ON cl.slug = t.category
       WHERE t.amount < 0 AND t.date >= ? AND t.date <= ? AND ${EXCLUDE_INTERNAL}
       GROUP BY t.category
       ORDER BY total DESC`
    )
    .all(toISODate(fromDate), toISODate(toDate));
}

// Compact summary only - aggregated numbers and a handful of labels, never
// raw transaction dumps, to keep the prompt short.
function buildSummary(db) {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const currentCategories = categoryBreakdown(db, currentMonthStart, now);
  const previousCategories = categoryBreakdown(db, prevMonthStart, prevMonthEnd);

  const currentTotal = currentCategories.reduce((s, r) => s + r.total, 0);
  const previousTotal = previousCategories.reduce((s, r) => s + r.total, 0);

  const sixMonthRows = db
    .prepare(
      `SELECT strftime('%Y-%m', date) AS month, SUM(-amount) AS total
       FROM transactions
       WHERE amount < 0 AND date >= ? AND ${EXCLUDE_INTERNAL}
       GROUP BY month`
    )
    .all(toISODate(sixMonthsAgo));
  const sixMonthAvgExpense = sixMonthRows.length
    ? sixMonthRows.reduce((s, r) => s + r.total, 0) / sixMonthRows.length
    : 0;

  const anomalyCount = db
    .prepare('SELECT COUNT(*) AS n FROM transactions WHERE is_anomaly = 1 AND date >= ? AND date <= ?')
    .get(toISODate(currentMonthStart), toISODate(now)).n;
  const topAnomalies = db
    .prepare(
      `SELECT description, amount, date FROM transactions
       WHERE is_anomaly = 1 AND date >= ? AND date <= ?
       ORDER BY ABS(amount) DESC LIMIT 3`
    )
    .all(toISODate(currentMonthStart), toISODate(now));

  const subs = db.prepare("SELECT COUNT(*) AS n, SUM(amount) AS total FROM subscriptions WHERE status = 'active'").get();

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

async function generateInsight(db, adapter) {
  let activeAdapter;
  try {
    activeAdapter = adapter || getAdapter();
  } catch (err) {
    console.error('generateInsight: adapter unavailable, skipping:', err.message);
    return null;
  }

  let summary;
  try {
    summary = buildSummary(db);
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
    db.prepare("INSERT INTO insights (text, generated_at) VALUES (?, datetime('now'))").run(text);
  } catch (err) {
    console.error('generateInsight: failed to persist insight:', err.message);
    return null;
  }

  return text;
}

module.exports = { generateInsight };
