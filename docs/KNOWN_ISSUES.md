# Known Issues

Tracked bugs and technical debt, deferred intentionally. Update this file whenever a new one is found or an existing one is fixed.

## Open

1. **Sessions not invalidated on password change/reset** - changing a password (via Settings or the forgot-password flow) does not log out other active sessions for that user. A stolen password stays usable on an already-logged-in device until the 7-day session expires naturally.

2. **Email-change typo lockout** - if a user mistypes their new email in Settings, their current session keeps working, but once it ends they're locked out: login requires email_verified, verification requires clicking a link sent to the (wrong) new address, and resend-verification keeps targeting that same wrong address. No recovery path exists yet.

3. **Account deletion during active bank sync not handled** - deleting an account while a scrape/sync job is running for it isn't guarded against; the sync could fail mid-write.

4. **Foreign key mismatch on live DB** - `accounts` and `insights` tables in the live database predate the `ON DELETE CASCADE` rule now in schema.sql (CREATE TABLE IF NOT EXISTS never retrofits existing tables). The account-deletion route works around this by deleting those rows manually before deleting the user. A future migration should rebuild these tables with the correct cascade rule so the workaround can be removed.

6. **`other` category still includes internal money movements** - self-transfers and deposit withdrawal/repayment rows aren't separated from real spending, inflating the `other` category and skewing analytics.

7. **card_payment dedup only covers one mapped card** - `card_mappings` has a single entry (`0659 -> account 17`). Yossi's cards aren't mapped, so his CAL charges aren't deduplicated against the bank aggregate line the way Ron's are.

8. **5 npm vulnerabilities** - upstream, documented, not yet resolved.

9. **Partial or missing sync months drag the monthly average down** - the dashboard's monthly average treats every month with data as a full month. History starting mid-month (2025-09 begins on the 16th) or a month with a single stray row (2026-01: one 7 ILS row, likely a sync gap) pull the average down, so a normal month reads as further above average than it really is.

10. **Which baseline percent-above-average should use is undecided** - it currently compares this month against the average of all months including the current one. For "all accounts" in 2026-09 (3,193 ILS) that gives +98%; against the average of previous months only it would be +116%, and against the previous month alone (2026-08, 1,925 ILS) +66%. Decide which basis is most useful.

11. **No visibility into incoming Bit payments** - the app only sees the eventual Bit-to-bank withdrawal ("...ביט משיכה לחשבון בנק", categorized `transfers` and counted as income), never the individual payments people sent to the Bit wallet. Bit income timing and detail are inferred from when the withdrawal happened, not from the original payments. A real fix needs a Bit integration, which is a separate future project.

## Resolved

5. **Dashboard "% above average" figure spikes on a single account** - fixed in 208d1f3. Cause: a near-zero baseline (a bank account whose spending is almost all excluded card_payment rows averaged a few shekels, so one ATM withdrawal showed as +1076%). The percentage is now hidden when the monthly average is below 100 ILS.
