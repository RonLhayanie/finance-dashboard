const SKIP_CATEGORIES = ['salary', 'transfers'];

// userId, when given, scopes detection (including the is_anomaly reset and
// the per-category mean/stddev calculation) to that user's own accounts -
// used by the per-user post-sync hook and /recompute route, and critically,
// keeps the mean/stddev computed only from that user's own rows, so one
// user's spending never skews another user's anomaly threshold. Omitted
// entirely, it processes every account across every user - relied on by the
// nightly cron, which scopes per-account itself by calling this once per
// synced account (see sync/engine.js).
function detectAnomalies(db, userId) {
  const scoped = Number.isInteger(userId);
  const acctFilter = scoped ? ' AND account_id IN (SELECT id FROM accounts WHERE user_id = ?)' : '';

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const cutoff = sixMonthsAgo.toISOString();

  const selectByCategory = db.prepare(
    `SELECT id, amount FROM transactions WHERE category = ? AND date >= ?${acctFilter}`
  );
  const flag = db.prepare('UPDATE transactions SET is_anomaly = 1 WHERE id = ?');

  let flaggedCount = 0;

  const run = db.transaction(() => {
    db.prepare(
      `UPDATE transactions SET is_anomaly = 0${scoped ? ' WHERE account_id IN (SELECT id FROM accounts WHERE user_id = ?)' : ''}`
    ).run(...(scoped ? [userId] : []));

    const categories = db
      .prepare(`SELECT DISTINCT category FROM transactions WHERE category IS NOT NULL AND date >= ?${acctFilter}`)
      .all(...(scoped ? [cutoff, userId] : [cutoff]))
      .map((r) => r.category)
      .filter((c) => !SKIP_CATEGORIES.includes(c));

    for (const category of categories) {
      const rows = selectByCategory.all(...(scoped ? [category, cutoff, userId] : [category, cutoff]));
      if (rows.length < 5) continue;

      const amounts = rows.map((r) => Math.abs(r.amount));
      const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
      const variance = amounts.reduce((sum, a) => sum + (a - mean) ** 2, 0) / amounts.length;
      const stddev = Math.sqrt(variance);
      const threshold = mean + 2.5 * stddev;

      for (const row of rows) {
        if (Math.abs(row.amount) > threshold) {
          flag.run(row.id);
          flaggedCount += 1;
        }
      }
    }
  });
  run();

  return flaggedCount;
}

module.exports = { detectAnomalies };
