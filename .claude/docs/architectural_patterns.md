# Architectural Patterns

## Scraper library over raw browser automation

Bank access goes through `israeli-bank-scrapers`, never through hand-rolled Playwright/Puppeteer selectors. The library already encodes each bank's login flow, DOM quirks, and transaction normalization, and it absorbs the breakage when a bank redesigns its site. New providers are added by passing a new `companyId` to the same scraper factory in `server/src/sync`, not by writing a new automation script. If a behavior seems to need raw browser control, first check whether the library exposes it as an option — dropping to raw Playwright forfeits every future upstream fix.

## OTP as a pause, not a failure

An SMS challenge is a normal branch of the scrape, not an error. When the scraper hits the OTP step it does not throw and it does not restart — the running scrape is held open in `server/src/sync` while the module's state machine moves `RUNNING` → `NEEDS_OTP`, exposing the pending challenge to the API layer. The submitted code is handed back into the *same* live scraper instance, which continues from where it stopped and returns to `RUNNING`. The OTP hook is wired generically: `scraper.js` attaches `otpCodeRetriever` only for providers whose `SCRAPERS[companyId].loginFields` declare it, so providers that never challenge (Leumi) leave it dormant with no special-casing. New interactive bank challenges (captcha, security questions) should add a new state to this same machine and reuse the pause/resume shape rather than aborting and retrying the scrape from scratch.

## Frontend polling, conditionally — no WebSockets

The dashboard learns about sync progress by polling the sync-state route every 3s, and *only* while a sync is active. Outside an active sync the frontend polls nothing. This is a deliberate trade: a single-user dashboard that syncs a few times a day does not justify the connection lifecycle, reconnect logic, and deployment constraints of a WebSocket layer, and the only real-time-ish requirement (surfacing an OTP prompt within seconds) is fully served by a 3s interval. New server→client signals should extend the existing state payload returned by that route rather than introducing a push channel.

## Single-user mindset: SQLite is the right size

This is one person's financial data on one machine, so `better-sqlite3` is the deliberate choice, not a placeholder for "a real database later." Its synchronous API means query code in `server/src/db` reads as straight-line logic with no connection pooling, no async ceremony, and no ORM layer. Design new features around that assumption: no multi-tenant `user_id` columns, no row-level access checks, no concurrency-control machinery. If a change only makes sense for multiple users, it does not belong in this project yet.

## Encrypted credentials at rest, decrypted at the last moment

Bank usernames and passwords are encrypted with AES-256-GCM before they touch SQLite, using the key from `MASTER_KEY` (64 hex chars / 32 bytes); the stored row keeps the IV and auth tag alongside the ciphertext so every decryption is authenticated and tampering fails loudly. All encrypt/decrypt lives in `server/src/crypto` and nowhere else, and it throws at load time if the key is missing or malformed — fail fast, never fall back to a default. Plaintext credentials exist only inside `server/src/sync`, in the moment between decrypting and handing them to the scraper — they are never logged, never returned by a route, and never held in module-level state. Any new secret the project stores follows the same path: encrypt in `crypto`, persist in `db`, decrypt at the point of use.

## Routes are thin; the layers below own the logic

`server/src/routes` does request parsing, calls into `sync`/`db`, and shapes the response — nothing more. It contains no SQL, no scraper calls, and no crypto. This keeps the sync state machine testable without an HTTP server and keeps the storage layer swappable without touching the API surface. When adding an endpoint, put the behavior in the owning module and let the route be a five-line adapter.

## The LLM never writes SQL

The AI advisor uses tool calling, not RAG and not generated SQL. `server/src/ai/tools.js` exposes a fixed whitelist of functions (`query_transactions`, `get_spending_summary`, `get_subscriptions`, `get_anomalies`, `list_categories`); each validates its arguments against literal allowlists before touching the database, and every statement underneath is a prepared statement with bound parameters. The model chooses *which* function to call and with what arguments — it never composes a query string, and it can never reach `accounts`, `users`, or `sync_jobs`. All arithmetic (sums, averages, grouping) happens in SQL, never in the model, so figures cannot be hallucinated. New capabilities are new whitelisted tools, never a loosened query interface.

## Analytics runs as a post-sync hook, and is idempotent

After the sync engine commits new transactions it runs categorization, then subscription detection, then anomaly detection — in that order, since each depends on the previous. Every one of them is safe to re-run over the full dataset: categorization only fills `NULL` categories, subscription detection upserts on `(account_id, merchant)`, and anomaly detection resets `is_anomaly` before recomputing. This is what makes `POST /api/analytics/recompute` safe to call at any time, and it means tuning a categorization rule is a config change plus a recompute, not a re-scrape.

## Bank and card accounts describe the same money differently

A bank account (Discount) and the credit card it settles (CAL) are both scraped, and they overlap: every itemized card purchase also appears in the bank as an aggregate charge line (`חיוב לכרטיס ויזה NNNN`). Counting both double-counts spending. The bank rows carry no merchant information — only the card provider knows *what* was bought — so the card is the source of truth for spending detail, and the bank's card-charge lines are an internal transfer that analytics must exclude. Any new provider pair with this settle-through relationship follows the same rule: itemize from the issuer, exclude the settlement line.