const SKIP_CATEGORIES = ['salary', 'transfers'];

// accountIds, when given, scopes detection (including the is_anomaly reset
// and the per-category mean/stddev calculation) to that set of accounts -
// used by the per-user /recompute route, and as a side effect keeps one
// user's spending out of another user's anomaly statistics. Omitted
// entirely, it processes every account - the existing behavior the
// post-sync hook in sync/engine.js still relies on.
function detectAnomalies(db, accountIds) {
  const scoped = Array.isArray(accountIds);
  if (scoped && accountIds.length === 0) return 0;
  const placeholders = scoped ? accountIds.map(() => '?').join(',') : null;
  const acctFilter = scoped ? ` AND account_id IN (${placeholders})` : '';

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const cutoff = sixMonthsAgo.toISOString();

  const selectByCategory = db.prepare(
    `SELECT id, amount FROM transactions WHERE category = ? AND date >= ?${acctFilter}`
  );
  const flag = db.prepare('UPDATE transactions SET is_anomaly = 1 WHERE id = ?');

  let flaggedCount = 0;

  const run = db.transaction(() => {
    db.prepare(`UPDATE transactions SET is_anomaly = 0${scoped ? ` WHERE account_id IN (${placeholders})` : ''}`).run(
      ...(scoped ? accountIds : [])
    );

    const categories = db
      .prepare(`SELECT DISTINCT category FROM transactions WHERE category IS NOT NULL AND date >= ?${acctFilter}`)
      .all(...(scoped ? [cutoff, ...accountIds] : [cutoff]))
      .map((r) => r.category)
      .filter((c) => !SKIP_CATEGORIES.includes(c));

    for (const category of categories) {
      const rows = selectByCategory.all(...(scoped ? [category, cutoff, ...accountIds] : [category, cutoff]));
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
