# Known Issues

Tracked bugs and technical debt, deferred intentionally. Update this file whenever a new one is found or an existing one is fixed.

## Open

1. **Sessions not invalidated on password change/reset** - changing a password (via Settings or the forgot-password flow) does not log out other active sessions for that user. A stolen password stays usable on an already-logged-in device until the 7-day session expires naturally.

2. **Email-change typo lockout** - if a user mistypes their new email in Settings, their current session keeps working, but once it ends they're locked out: login requires email_verified, verification requires clicking a link sent to the (wrong) new address, and resend-verification keeps targeting that same wrong address. No recovery path exists yet.

3. **Account deletion during active bank sync not handled** - deleting an account while a scrape/sync job is running for it isn't guarded against; the sync could fail mid-write.

4. **Foreign key mismatch on live DB** - `accounts` and `insights` tables in the live database predate the `ON DELETE CASCADE` rule now in schema.sql (CREATE TABLE IF NOT EXISTS never retrofits existing tables). The account-deletion route works around this by deleting those rows manually before deleting the user. A future migration should rebuild these tables with the correct cascade rule so the workaround can be removed.

5. **Dashboard "% above average" figure spikes on a single account** - known calculation bug, blocks considering the product ready for real use.

6. **`other` category still includes internal money movements** - self-transfers and deposit withdrawal/repayment rows aren't separated from real spending, inflating the `other` category and skewing analytics.

7. **card_payment dedup only covers one mapped card** - `card_mappings` has a single entry (`0659 -> account 17`). Yossi's cards aren't mapped, so his CAL charges aren't deduplicated against the bank aggregate line the way Ron's are.

8. **5 npm vulnerabilities** - upstream, documented, not yet resolved.

## Resolved

(move items here with the fix commit hash when closed)
