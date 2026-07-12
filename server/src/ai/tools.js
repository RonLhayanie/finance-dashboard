const db = require('../db/db');
const { CATEGORIES } = require('../analytics/categorize');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateDate(value, label) {
  if (value !== undefined && value !== null && !DATE_RE.test(value)) {
    throw new Error(`${label} must match YYYY-MM-DD`);
  }
}

function clampLimit(limit, fallback) {
  const n = Number.isInteger(limit) ? limit : fallback;
  return Math.min(100, Math.max(1, n));
}

function query_transactions(args = {}) {
  const { from, to, category, minAmount, maxAmount, limit } = args;
  validateDate(from, 'from');
  validateDate(to, 'to');
  if (category !== undefined && category !== null && !CATEGORIES.includes(category)) {
    throw new Error(`category must be one of: ${CATEGORIES.join(', ')}`);
  }
  if (minAmount !== undefined && typeof minAmount !== 'number') {
    throw new Error('minAmount must be a number');
  }
  if (maxAmount !== undefined && typeof maxAmount !== 'number') {
    throw new Error('maxAmount must be a number');
  }

  const clauses = [];
  const params = [];
  if (from !== undefined && from !== null) {
    clauses.push('date >= ?');
    params.push(from);
  }
  if (to !== undefined && to !== null) {
    clauses.push('date <= ?');
    params.push(to);
  }
  if (category !== undefined && category !== null) {
    clauses.push('category = ?');
    params.push(category);
  }
  if (minAmount !== undefined) {
    clauses.push('amount >= ?');
    params.push(minAmount);
  }
  if (maxAmount !== undefined) {
    clauses.push('amount <= ?');
    params.push(maxAmount);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `SELECT date, amount, currency, description, category FROM transactions ${where} ORDER BY date DESC LIMIT ?`;
  params.push(clampLimit(limit, 50));

  return db.prepare(sql).all(...params);
}

// groupBy is validated against a fixed whitelist and mapped to a fixed SQL
// fragment - the raw input string is never spliced into the query.
const GROUP_BY_SQL = {
  category: 'category',
  month: "strftime('%Y-%m', date)",
};

function get_spending_summary(args = {}) {
  const { from, to, groupBy } = args;
  validateDate(from, 'from');
  validateDate(to, 'to');
  if (!Object.prototype.hasOwnProperty.call(GROUP_BY_SQL, groupBy)) {
    throw new Error("groupBy must be 'category' or 'month'");
  }
  const groupExpr = GROUP_BY_SQL[groupBy];

  const clauses = [];
  const params = [];
  if (from !== undefined && from !== null) {
    clauses.push('date >= ?');
    params.push(from);
  }
  if (to !== undefined && to !== null) {
    clauses.push('date <= ?');
    params.push(to);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const sql = `
    SELECT ${groupExpr} AS group_key, SUM(amount) AS total, COUNT(*) AS count
    FROM transactions
    ${where}
    GROUP BY ${groupExpr}
    ORDER BY group_key
  `;
  return db.prepare(sql).all(...params);
}

function get_subscriptions() {
  return db
    .prepare(
      'SELECT account_id, merchant, amount, frequency, last_charged, status FROM subscriptions ORDER BY status, merchant'
    )
    .all();
}

function get_anomalies(args = {}) {
  const { limit } = args;
  return db
    .prepare(
      'SELECT date, amount, currency, description, category FROM transactions WHERE is_anomaly = 1 ORDER BY date DESC LIMIT ?'
    )
    .all(clampLimit(limit, 50));
}

function list_categories() {
  return CATEGORIES;
}

const TOOLS = [
  {
    name: 'query_transactions',
    description: 'Query raw transactions with optional filters for date range, category, and amount range.',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Start date YYYY-MM-DD' },
        to: { type: 'string', description: 'End date YYYY-MM-DD' },
        category: { type: 'string', enum: CATEGORIES },
        minAmount: { type: 'number' },
        maxAmount: { type: 'number' },
        limit: { type: 'integer', description: 'Max rows, 1-100, default 50' },
      },
    },
    execute: query_transactions,
  },
  {
    name: 'get_spending_summary',
    description: 'Get total spend and transaction counts grouped by category or by month.',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string' },
        to: { type: 'string' },
        groupBy: { type: 'string', enum: ['category', 'month'] },
      },
      required: ['groupBy'],
    },
    execute: get_spending_summary,
  },
  {
    name: 'get_subscriptions',
    description: 'List all detected subscriptions, active and cancelled.',
    parameters: { type: 'object', properties: {} },
    execute: get_subscriptions,
  },
  {
    name: 'get_anomalies',
    description: 'List transactions flagged as anomalies, newest first.',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'integer' } },
    },
    execute: get_anomalies,
  },
  {
    name: 'list_categories',
    description: 'List all valid transaction categories.',
    parameters: { type: 'object', properties: {} },
    execute: list_categories,
  },
];

module.exports = {
  TOOLS,
  query_transactions,
  get_spending_summary,
  get_subscriptions,
  get_anomalies,
  list_categories,
};
