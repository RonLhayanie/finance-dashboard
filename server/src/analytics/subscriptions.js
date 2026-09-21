const EXPECTED_INTERVAL_DAYS = { monthly: 30, yearly: 365 };

function normalizeMerchant(description) {
  return (description || '')
    .toLowerCase()
    .replace(/\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function daysBetween(a, b) {
  return Math.abs(new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24);
}

function classifyFrequency(gaps) {
  if (gaps.length > 0 && gaps.every((g) => g >= 25 && g <= 35)) return 'monthly';
  if (gaps.length > 0 && gaps.every((g) => g >= 350 && g <= 380)) return 'yearly';
  return null;
}

// Charges are stored as negative amounts (the scraper passes through the
// library's chargedAmount, which is negative for debits, positive for credits).
// Only negative amounts represent real recurring charges.
// userId, when given, scopes both detection and status maintenance to that
// user's own accounts (used by the per-user post-sync hook and /recompute
// route) - recurrence (the gap/median grouping below) is computed only from
// rows already limited to that user's own accounts, so one user's charges
// never feed another user's subscription detection. Omitted entirely, it
// processes every account across every user - relied on by the nightly
// cron, which scopes per-account itself by calling this once per synced
// account (see sync/engine.js).
function detectSubscriptions(db, userId) {
  const scoped = Number.isInteger(userId);
  const acctFilter = scoped ? ' AND account_id IN (SELECT id FROM accounts WHERE user_id = ?)' : '';

  const rows = db
    .prepare(
      `SELECT id, account_id, date, amount, description
       FROM transactions
       WHERE amount < 0${acctFilter}
       ORDER BY account_id, date ASC`
    )
    .all(...(scoped ? [userId] : []));

  const groups = new Map();
  for (const row of rows) {
    const merchant = normalizeMerchant(row.description);
    const key = `${row.account_id}::${merchant}`;
    if (!groups.has(key)) {
      groups.set(key, { accountId: row.account_id, merchant, rows: [] });
    }
    groups.get(key).rows.push(row);
  }

  const upsert = db.prepare(`
    INSERT INTO subscriptions (account_id, merchant, amount, frequency, last_charged, status)
    VALUES (@accountId, @merchant, @amount, @frequency, @lastCharged, 'active')
    ON CONFLICT(account_id, merchant) DO UPDATE SET
      amount = excluded.amount,
      frequency = excluded.frequency,
      last_charged = excluded.last_charged,
      status = 'active'
  `);

  let touched = 0;

  const run = db.transaction(() => {
    for (const group of groups.values()) {
      if (group.rows.length < 3) continue;

      const amounts = group.rows.map((r) => Math.abs(r.amount));
      const med = median(amounts);
      const withinTolerance = amounts.every((a) => Math.abs(a - med) <= med * 0.1);
      if (!withinTolerance) continue;

      const gaps = [];
      for (let i = 1; i < group.rows.length; i += 1) {
        gaps.push(daysBetween(group.rows[i - 1].date, group.rows[i].date));
      }
      const frequency = classifyFrequency(gaps);
      if (!frequency) continue;

      const lastCharged = group.rows[group.rows.length - 1].date;
      upsert.run({
        accountId: group.accountId,
        merchant: group.merchant,
        amount: med,
        frequency,
        lastCharged,
      });
      touched += 1;
    }

    // Status maintenance runs over every existing subscription row in scope,
    // not just groups matched above, since a merchant may have stopped
    // charging entirely.
    const existing = db
      .prepare(
        `SELECT id, frequency, last_charged FROM subscriptions${scoped ? ` WHERE account_id IN (SELECT id FROM accounts WHERE user_id = ?)` : ''}`
      )
      .all(...(scoped ? [userId] : []));
    const setStatus = db.prepare('UPDATE subscriptions SET status = ? WHERE id = ?');
    const now = new Date().toISOString();
    for (const sub of existing) {
      const intervalDays = EXPECTED_INTERVAL_DAYS[sub.frequency];
      const staleDays = daysBetween(sub.last_charged, now);
      const status = staleDays > intervalDays * 1.5 ? 'cancelled' : 'active';
      setStatus.run(status, sub.id);
    }
  });
  run();

  return touched;
}

module.exports = { normalizeMerchant, detectSubscriptions };
