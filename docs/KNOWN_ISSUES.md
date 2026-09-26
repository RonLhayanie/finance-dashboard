# Known Issues

Tracked bugs and technical debt, deferred intentionally. Update this file whenever a new one is found or an existing one is fixed.

## Open

2. **Email-change typo lockout** - if a user mistypes their new email in Settings, their current session keeps working, but once it ends they're locked out: login requires email_verified, verification requires clicking a link sent to the (wrong) new address, and resend-verification keeps targeting that same wrong address. No recovery path exists yet.

3. **Account deletion during active bank sync not handled** - deleting an account while a scrape/sync job is running for it isn't guarded against; the sync could fail mid-write.

4. **Foreign key mismatch on live DB** - `accounts` and `insights` tables in the live database predate the `ON DELETE CASCADE` rule now in schema.sql (CREATE TABLE IF NOT EXISTS never retrofits existing tables). The account-deletion route works around this by deleting those rows manually before deleting the user. A future migration should rebuild these tables with the correct cascade rule so the workaround can be removed.

7. **card_payment dedup only covers one mapped card** - `card_mappings` has a single entry (`0659 -> account 17`). Yossi's cards aren't mapped, so his CAL charges aren't deduplicated against the bank aggregate line the way Ron's are. Scheduled for Yossi's onboarding (map his card's last 4 digits to his card account once his accounts have synced), not the pre-launch hardening. Note that `schema.sql` seeds `0659 -> 17`, which is wrong on a fresh database where account ids differ.

8. **npm vulnerabilities** - GitHub Dependabot reports 13 on the default branch (8 high, 5 moderate) as of 2026-09-26, up from the 5 previously noted. Upstream, not yet resolved.

9. **Partial or missing sync months drag the monthly average down** - the dashboard's monthly average treats every month with data as a full month. History starting mid-month (2025-09 begins on the 16th) or a month with a single stray row (2026-01: one 7 ILS row, likely a sync gap) pull the average down, so a normal month reads as further above average than it really is.

10. **Which baseline percent-above-average should use is undecided** - it currently compares this month against the average of all months including the current one. For "all accounts" in 2026-09 (3,193 ILS) that gives +98%; against the average of previous months only it would be +116%, and against the previous month alone (2026-08, 1,925 ILS) +66%. Decide which basis is most useful.

11. **No visibility into incoming Bit payments** - the app only sees the eventual Bit-to-bank withdrawal ("...ביט משיכה לחשבון בנק", categorized `transfers` and counted as income), never the individual payments people sent to the Bit wallet. Bit income timing and detail are inferred from when the withdrawal happened, not from the original payments. A real fix needs a Bit integration, which is a separate future project.

12. **Category chart slices are keyed by label** - `SpendingByCategory.jsx` renders slices with `key={entry.name}` (the display label). Two slices with the same label get duplicate React keys, which can cause render glitches when the data changes. The one known collision (the long-tail bucket also being called "אחר") was fixed by renaming the bucket to "קטגוריות נוספות", but keying by category slug would rule it out entirely.

13. **Category chart nets each category's total** - the chart takes each category's net sum and only shows categories that come out negative. A category with both spending and income can show a positive net and disappear from the spending chart even though it contains real spending: `transfers` holds Bit payments made by card (outgoing) and Bit-to-bank withdrawals (incoming), and the incoming side is larger. In 2026-09 this hid 110 ILS of card Bit payments. Refunds shrink a category's slice the same way (e.g. `shopping`).

14. **Frontend category label map is incomplete** - `client/src/utils/categories.js` has no labels for `interest`, `internal`, or `card_payment`, unlike the server-side `category_labels` table. Harmless today because those are never shown in the category chart (excluded, or income-only), but an unknown slug renders as the raw slug, so the two maps should be synced if that changes.

15. **Subscriptions "last charged" date shows the UTC day** - `SubscriptionsTable.jsx` displays `last_charged.slice(0, 10)`, the UTC date of a stored UTC timestamp, so charges recorded at local midnight show one day early. Same class of bug as the one fixed for transaction dates (use `formatDay` from `client/src/utils/format.js`); not applied yet because that file has unrelated uncommitted changes.

16. **Single instance only (scaling limit)** - sessions live in server memory and the database is one SQLite file, so the app supports exactly one server instance/replica. Fine at the current scale (a handful of users). Running multiple Railway replicas would need a shared session store and a database that multiple instances can use; until then, keep the service at one replica (a redeploy also logs everyone out).

## Resolved

5. **Dashboard "% above average" figure spikes on a single account** - fixed in 208d1f3. Cause: a near-zero baseline (a bank account whose spending is almost all excluded card_payment rows averaged a few shekels, so one ATM withdrawal showed as +1076%). The percentage is now hidden when the monthly average is below 100 ILS.

6. **`other` category still includes internal money movements** - did not reproduce; resolved in 50fbc88. When investigated, `other` held 17 rows / 409 ILS of genuine spending and no internal movements: deposit principal was already categorized `internal` (excluded from analytics). The real issue was the reverse - deposit interest (~56 ILS) was also in `internal` instead of counting as income. Deterministic rules in categorize.js now send deposit principal to `internal` and deposit interest to a new `interest` category (counted as income). Bit-to-bank withdrawals were already in `transfers`, not `internal`, so they already counted as income and needed no change (see #11 for the Bit visibility limitation).

1. **Sessions not invalidated on password change/reset** - resolved in the commit "Pre-launch security hardening". Changing the password in Settings now logs out every other session of that user (the current one stays), and a forgot-password reset logs out all of them.
