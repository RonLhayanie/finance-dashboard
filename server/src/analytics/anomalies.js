const SKIP_CATEGORIES = ['salary', 'transfers'];

function detectAnomalies(db) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const cutoff = sixMonthsAgo.toISOString();

  const selectByCategory = db.prepare(
    'SELECT id, amount FROM transactions WHERE category = ? AND date >= ?'
  );
  const flag = db.prepare('UPDATE transactions SET is_anomaly = 1 WHERE id = ?');

  let flaggedCount = 0;

  const run = db.transaction(() => {
    db.prepare('UPDATE transactions SET is_anomaly = 0').run();

    const categories = db
      .prepare('SELECT DISTINCT category FROM transactions WHERE category IS NOT NULL AND date >= ?')
      .all(cutoff)
      .map((r) => r.category)
      .filter((c) => !SKIP_CATEGORIES.includes(c));

    for (const category of categories) {
      const rows = selectByCategory.all(category, cutoff);
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
