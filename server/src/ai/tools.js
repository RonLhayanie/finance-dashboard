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

function getValidCategorySlugs() {
  return db.prepare('SELECT slug FROM category_labels').all().map((r) => r.slug);
}

// Every function below that touches transactions/subscriptions requires
// userId and scopes its query by it. userId is never taken from an LLM tool
// call's arguments (see ai/chat.js, which always overrides it with the
// authenticated request's own req.userId) - this check is a backstop so a
// scoping bug elsewhere fails loudly instead of silently returning
// cross-user data.
function requireUserId(userId) {
  if (!Number.isInteger(userId)) {
    throw new Error('userId is required');
  }
}

// accountId is optional and additive on top of the userId scope above, never
// a replacement for it - the base clause is always
// `account_id IN (SELECT id FROM accounts WHERE user_id = ?)`, and this just
// ANDs a further `account_id = ?` restriction. An accountId that isn't one
// of the caller's own accounts is never a separate error case: it's already
// excluded by the userId subquery, so the combined result is just empty.
function validateAccountId(accountId) {
  if (accountId !== undefined && accountId !== null && !Number.isInteger(accountId)) {
    throw new Error('accountId must be an integer');
  }
}

function query_transactions(args = {}) {
  const { userId, from, to, category, minAmount, maxAmount, limit } = args;
  requireUserId(userId);
  validateDate(from, 'from');
  validateDate(to, 'to');
  if (category !== undefined && category !== null) {
    const validSlugs = getValidCategorySlugs();
    if (!validSlugs.includes(category)) {
      throw new Error(`category must be one of: ${validSlugs.join(', ')}`);
    }
  }
  if (minAmount !== undefined && typeof minAmount !== 'number') {
    throw new Error('minAmount must be a number');
  }
  if (maxAmount !== undefined && typeof maxAmount !== 'number') {
    throw new Error('maxAmount must be a number');
  }

  const clauses = ['account_id IN (SELECT id FROM accounts WHERE user_id = ?)'];
  const params = [userId];
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
  } else {
    clauses.push("(category IS NULL OR category NOT IN ('card_payment', 'internal'))");
  }
  if (minAmount !== undefined) {
    clauses.push('amount >= ?');
    params.push(minAmount);
  }
  if (maxAmount !== undefined) {
    clauses.push('amount <= ?');
    params.push(maxAmount);
  }

  const where = `WHERE ${clauses.join(' AND ')}`;
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
  const { userId, from, to, groupBy, accountId } = args;
  requireUserId(userId);
  validateAccountId(accountId);
  validateDate(from, 'from');
  validateDate(to, 'to');
  if (!Object.prototype.hasOwnProperty.call(GROUP_BY_SQL, groupBy)) {
    throw new Error("groupBy must be 'category' or 'month'");
  }
  const groupExpr = GROUP_BY_SQL[groupBy];

  const clauses = ['account_id IN (SELECT id FROM accounts WHERE user_id = ?)'];
  const params = [userId];
  if (accountId !== undefined && accountId !== null) {
    clauses.push('account_id = ?');
    params.push(accountId);
  }
  if (from !== undefined && from !== null) {
    clauses.push('date >= ?');
    params.push(from);
  }
  if (to !== undefined && to !== null) {
    clauses.push('date <= ?');
    params.push(to);
  }
  clauses.push("(category IS NULL OR category NOT IN ('card_payment', 'internal'))");
  const where = `WHERE ${clauses.join(' AND ')}`;

  const sql = `
    SELECT ${groupExpr} AS group_key, SUM(amount) AS total, COUNT(*) AS count
    FROM transactions
    ${where}
    GROUP BY ${groupExpr}
    ORDER BY group_key
  `;
  return db.prepare(sql).all(...params);
}

function get_subscriptions(args = {}) {
  const { userId } = args;
  requireUserId(userId);
  return db
    .prepare(
      `SELECT account_id, merchant, amount, frequency, last_charged, status
       FROM subscriptions
       WHERE account_id IN (SELECT id FROM accounts WHERE user_id = ?)
       ORDER BY status, merchant`
    )
    .all(userId);
}

function get_anomalies(args = {}) {
  const { userId, from, to, accountId, limit } = args;
  requireUserId(userId);
  validateAccountId(accountId);
  validateDate(from, 'from');
  validateDate(to, 'to');

  const clauses = [
    'is_anomaly = 1',
    'account_id IN (SELECT id FROM accounts WHERE user_id = ?)',
    "(category IS NULL OR category NOT IN ('card_payment', 'internal'))",
  ];
  const params = [userId];
  if (accountId !== undefined && accountId !== null) {
    clauses.push('account_id = ?');
    params.push(accountId);
  }
  if (from !== undefined && from !== null) {
    clauses.push('date >= ?');
    params.push(from);
  }
  if (to !== undefined && to !== null) {
    clauses.push('date <= ?');
    params.push(to);
  }

  const sql = `SELECT date, amount, currency, description, category FROM transactions WHERE ${clauses.join(' AND ')} ORDER BY date DESC LIMIT ?`;
  params.push(clampLimit(limit, 50));
  return db.prepare(sql).all(...params);
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
      properties: {
        from: { type: 'string', description: 'Start date YYYY-MM-DD' },
        to: { type: 'string', description: 'End date YYYY-MM-DD' },
        limit: { type: 'integer' },
      },
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
