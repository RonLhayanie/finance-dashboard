# Fable Finance Dashboard - Work Session Handoff (2026-09-14)

## Where we are
Returning to the Fable personal finance dashboard after a ~2-month pause, working through a
staged bug-fix plan. One bug per stage, in a fixed order, with explanation and approval before
any code is written, and verification before moving on. Return complete files, never diffs.
No Hebrew comments or emojis in code.

## Canonical location (important)
The ONLY source of truth is `C:\Projects\Financial_Dashboard\finance-dashboard`.
Stale duplicate copies existed under OneDrive and at `C:\dev\finance-dashboard` and caused a
lot of confusion (writes failing on OneDrive locks, tests running against a different DB with
different data). Always work from the canonical path. Note: the in-repo CLAUDE.md still points
to `C:\dev\` and describes the chat bug as a "502" - both are stale and should be corrected in
a later cleanup pass (not urgent, out of current scope).

## The staged plan
- Stage 1 - AI chat failure: DONE (see below)
- Stage 2 - CAL/Discount double-counting: NEXT (analysis done, no code yet)
- Stage 3 - silent transaction loss via weak fallback external-id hash (scraper.js externalIdFor)
- Stage 4 - OTP pause/resume is dead code for all supported providers: design discussion first,
  not a code task

## Stage 1 - DONE (2026-09-14)
Symptom was the chat returning "The assistant could not complete the request within the tool
budget", NOT the originally-suspected 502. We proved via live testing that the tool-calling
round-trip, message injection, and Gemini thoughtSignature handling are all correct - do not
touch them. The real cause: Gemini 3.8 Flash (a thinking model) over-explores on open-ended
questions and never converges within MAX_ITERATIONS=6.

Fix applied to two files:
- server/src/ai/chat.js: rewrote SYSTEM_PROMPT to steer efficiency (minimum tools, prefer
  get_spending_summary over raw rows, answer as soon as data suffices); raised MAX_ITERATIONS
  6 -> 10; switched to lazy+cached adapter via getAdapter(), wrapped so a bad config returns the
  graceful fallback instead of throwing.
- server/src/ai/adapter.js: removed the module-load-time `const defaultAdapter = createAdapter();`
  and removed it from exports (only createAdapter is exported now). Nothing else changed.

Verified: server boots clean even with a deliberately broken LLM_PROVIDER (only chat degrades,
auth/sync/analytics keep working), and the open-ended Hebrew question now returns a real ranked
answer within budget.

Note: a bad LLM_MODEL never crashed the server at boot (it only fails at first API call, caught
in routes/chat.js as a 502). What used to crash boot was a bad LLM_PROVIDER/LLM_API_KEY, because
createAdapter() ran at require time. That is what the lazy-init fixed.

## Stage 2 - NEXT: CAL/Discount double-counting (analysis complete, NO code yet)
Problem: the same purchase appears twice. The bank (Discount) shows an aggregate settlement line
with the exact text `חיוב לכרטיס ויזה 0659` (no merchant, always category `other`), and CAL shows
the real itemized transaction with the merchant name. Same amount, but dates differ by ~1-2 days.
This double-counts spending and inflates the `other` category (~18,431 ILS observed).

Confirmed live data structure:
- account 16 = Discount (bank), holds the aggregate `חיוב לכרטיס ויזה 0659` lines
- account 17 = CAL (credit card), holds the itemized merchant lines
- Example: bank -369.5 on 2026-07-04 "חיוב לכרטיס ויזה 0659" == CAL -369.5 on 2026-07-02
  "ברשקה קניון הזהב". Amount matches exactly; date does not. So matching must key on amount +
  card-account linkage, NOT date.

CRITICAL constraint - the fix must be CONDITIONAL, not a blanket filter:
Yossi (the second user) is on Leumi and also has NON-BANK credit cards whose charges are not
settled through his bank as aggregate lines. A naive "drop every `חיוב לכרטיס` bank line" rule
would wrongly delete real spending for setups where no linked card account covers those charges.
The suppression must only apply when a linked card account actually accounts for the bank
aggregate line.

Chosen direction (from the project's own architectural_patterns.md - "the bank's card-charge
lines are an internal transfer that analytics must exclude"): exclude/label the bank aggregate
lines from spending analytics rather than the CAL itemized lines (CAL has the merchant detail,
which is what matters). Prefer the simple approach (identify and exclude the bank aggregate
lines) over trying to match each aggregate to a group of CAL transactions - but gated on the
linked-card condition above.

Open questions to resolve BEFORE writing Stage 2 code:
1. Inspect Yossi's accounts/transactions to see how his non-bank cards actually look in the data,
   so the conditional rule is built against real structure, not assumptions.
2. Decide the exact detection rule for a "bank aggregate card line" (the fixed `חיוב לכרטיס`
   text is a strong signal; confirm it is stable across banks - Leumi may phrase it differently).
3. Decide implementation point: schema flag vs. categorizer rule vs. analytics-query exclusion,
   and make sure ALL read paths (analytics routes AND ai/tools.js) apply it consistently.

## Working style reminders
- Plan and explain before coding; wait for Ron's approval; verify each stage before the next.
- Complete files, not diffs. Clean code, English only, no emojis.
- There is a throwaway inspect script (server/inspect-dupes.js) that should be deleted if still
  present.
