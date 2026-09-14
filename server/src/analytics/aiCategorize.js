const { createAdapter } = require('../ai/adapter');

const BATCH_SIZE = 40;

// Lazy + cached, same pattern as ai/chat.js's getAdapter - a missing/bad
// LLM_PROVIDER config must not crash the sync, only skip AI categorization.
let cachedAdapter = null;
function getAdapter() {
  if (!cachedAdapter) {
    cachedAdapter = createAdapter();
  }
  return cachedAdapter;
}

function stripJsonFences(text) {
  return (text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
}

function buildSystemPrompt(existingSlugs) {
  return [
    'You categorize Israeli merchant/transaction descriptions into spending categories.',
    `Existing category slugs: ${existingSlugs.join(', ')}.`,
    '',
    'Rules:',
    '- Return ONLY valid JSON, no markdown fences, no prose before or after it.',
    '- Response shape exactly: {"assignments":{"<merchant description>":"<slug>", ...},"new_labels":{"<new_slug>":"<short Hebrew label>", ...}}',
    '- Every merchant description given to you must appear as a key in "assignments".',
    '- STRONGLY PREFER an existing slug when the merchant reasonably fits one.',
    '- Only invent a NEW slug when no existing category fits (e.g. a cinema -> "cinema").',
    '  New slugs must be lowercase English, a single word or underscore_separated.',
    '- If you introduce a new slug, you MUST also add a short natural Hebrew label',
    '  for it under "new_labels". Do not add a "new_labels" entry for an existing slug.',
    '- If a merchant is truly unrecognizable, use "other".',
  ].join('\n');
}

async function aiCategorizeUncategorized(db, adapter) {
  const summary = { categorized: 0, newCategories: [], fromCache: 0 };

  const rows = db
    .prepare(
      "SELECT DISTINCT description FROM transactions WHERE (category = 'other' OR category IS NULL) AND description IS NOT NULL"
    )
    .all();
  if (rows.length === 0) return summary;

  const cacheStmt = db.prepare('SELECT category FROM merchant_categories WHERE merchant = ?');
  const updateTxnStmt = db.prepare('UPDATE transactions SET category = ? WHERE description = ?');
  const upsertCacheStmt = db.prepare('INSERT OR REPLACE INTO merchant_categories (merchant, category) VALUES (?, ?)');
  const insertLabelStmt = db.prepare('INSERT OR IGNORE INTO category_labels (slug, label_he) VALUES (?, ?)');

  const remaining = [];
  for (const r of rows) {
    const cached = cacheStmt.get(r.description);
    if (cached) {
      updateTxnStmt.run(cached.category, r.description);
      summary.fromCache += 1;
      summary.categorized += 1;
    } else {
      remaining.push(r.description);
    }
  }

  if (remaining.length === 0) return summary;

  let activeAdapter;
  try {
    activeAdapter = adapter || getAdapter();
  } catch (err) {
    console.error('aiCategorizeUncategorized: adapter unavailable, skipping AI categorization:', err.message);
    return summary;
  }

  // Re-read after the cache pass above so slugs picked up from cache (which may
  // include AI-invented ones from a previous run) are treated as "existing".
  let existingSlugs = db.prepare('SELECT slug FROM category_labels').all().map((r) => r.slug);

  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE);
    const system = buildSystemPrompt(existingSlugs);
    const userMessage = { role: 'user', content: JSON.stringify(batch) };

    let result;
    try {
      result = await activeAdapter.complete({ system, messages: [userMessage], tools: [] });
    } catch (err) {
      console.error('aiCategorizeUncategorized: AI call failed for a batch, skipping it:', err.message);
      continue;
    }

    if (!result || result.type !== 'text' || !result.text) {
      console.error('aiCategorizeUncategorized: unexpected AI response shape for a batch, skipping it');
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(stripJsonFences(result.text));
    } catch (err) {
      console.error('aiCategorizeUncategorized: failed to parse AI response JSON for a batch, skipping it:', err.message);
      continue;
    }

    const assignments = parsed.assignments || {};
    const newLabels = parsed.new_labels || {};

    for (const [slug, labelHe] of Object.entries(newLabels)) {
      if (typeof slug !== 'string' || typeof labelHe !== 'string') continue;
      if (!existingSlugs.includes(slug)) {
        insertLabelStmt.run(slug, labelHe);
        existingSlugs.push(slug);
        summary.newCategories.push(slug);
      }
    }

    for (const [merchant, slug] of Object.entries(assignments)) {
      if (typeof slug !== 'string') continue;
      // A slug the model used but never declared in new_labels falls back to
      // 'other' rather than writing an unlabeled category into transactions.
      const finalSlug = existingSlugs.includes(slug) ? slug : 'other';
      upsertCacheStmt.run(merchant, finalSlug);
      updateTxnStmt.run(finalSlug, merchant);
      summary.categorized += 1;
    }
  }

  return summary;
}

module.exports = { aiCategorizeUncategorized };
