# finance-dashboard

A self-hosted personal finance dashboard for Israeli bank and credit card accounts. It pulls
transactions with [`israeli-bank-scrapers`](https://github.com/eshaham/israeli-bank-scrapers),
stores them in SQLite, categorises them, detects recurring subscriptions and unusual charges,
and exposes an LLM chat that answers questions about the data using read-only tools.

Single-user by design. Intended to run on a machine you control, reachable over a private
network, not on the public internet.

## Security model

The application authenticates to real bank accounts, so credential handling is the part worth
reading first.

- **Bank credentials are entered at runtime** through the Accounts page. They are never in
  source, never in `.env`, and never written to disk in plaintext.
- **They are encrypted with AES-256-GCM** (`server/src/crypto/vault.js`) and stored in the
  `accounts` table as three columns: ciphertext, IV and auth tag. A fresh 12-byte IV is
  generated per encryption.
- **The master key lives only in the environment.** `MASTER_KEY` must be 64 hex characters
  (32 bytes). `vault.js` throws at module load if it is missing or the wrong length, so the
  server refuses to start rather than run without encryption.
- **Credentials are decrypted only in memory**, at the moment a sync runs, and handed straight
  to the scraper.
- **The dashboard password is hashed with scrypt** (N=16384, r=8, p=1) with a per-user random
  salt, and verified with `crypto.timingSafeEqual`.
- Every route under `/api` except `/api/health` and `/api/auth` requires a session cookie.

Losing `MASTER_KEY` means the stored bank credentials cannot be decrypted and must be re-entered.
Back it up separately from the database.

## Architecture

```
client/          React 19 SPA (Vite, Tailwind 4, React Router 7, Recharts)
server/
  src/
    index.js         Express app; serves the API and the built client
    auth/            scrypt password hashing, in-memory sessions, cookie middleware
    crypto/vault.js  AES-256-GCM encrypt/decrypt
    db/              better-sqlite3 connection and schema
    sync/
      engine.js      sync job lifecycle and state machine
      scraper.js     israeli-bank-scrapers wrapper
      otpBridge.js   in-memory promise bridge for one-time passwords
      errorCodes.js  maps raw scraper errors to stable frontend codes
    analytics/       categorisation, subscription detection, anomaly detection
    ai/
      adapter.js     provider abstraction over Anthropic and Gemini
      tools.js       five read-only SQL-backed tools
      chat.js        tool-use loop
    scheduler.js     nightly cron sync
deploy/          systemd unit and WAL-safe SQLite backup script
```

### Sync and the OTP problem

A sync is a row in `sync_jobs` moving through `RUNNING`, optionally `NEEDS_OTP`, and ending at
`DONE` or `FAILED`. Only one non-terminal job per account may exist at a time; starting a second
raises a conflict.

Some providers require a one-time password mid-scrape. The scraper expects a callback that
returns the code, but the code arrives later over HTTP from the browser. `otpBridge.js` resolves
this with a `Map` of pending promises: the sync sets the job to `NEEDS_OTP` and awaits, the
frontend polls, the user submits the code, and `submitOtp` resolves the waiting promise. There
is a 180-second timeout, and `cancelOtp` rejects the wait if a stuck job is force-reset.

Because the bridge lives in process memory, a server restart mid-sync leaves an orphaned
`RUNNING` row. `resetStuckJobs` marks those `FAILED` with a distinguishable message rather than
deleting them, preserving job history.

### Analytics

Run automatically after every successful sync.

- **Categorisation** assigns each transaction to a fixed category list.
- **Subscription detection** normalises merchant names, requires at least three charges, amounts
  within 10% of the median, and gaps of 25-35 days (monthly) or 350-380 days (yearly).
- **Anomaly detection** flags transactions above `mean + 2.5 * stddev` within their category over
  a six-month window, skipping salary and transfers, and requiring at least five samples.

### AI chat

`adapter.js` normalises Anthropic and Gemini behind one `complete()` interface, using each
provider's real structured tool protocol rather than JSON stuffed into text turns. `chat.js` runs
the tool loop for at most six iterations.

The five tools are read-only and parameterised. `groupBy` is validated against a whitelist and
mapped to a fixed SQL fragment, so no user or model input is ever concatenated into a query.

## Setup

```bash
cd server && npm install
cd ../client && npm install
```

Create `server/.env` from the template:

```bash
cp server/.env.example server/.env
```

Generate a master key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Create the dashboard user:

```bash
cd server
node scripts/create-user.js <username> <password>
```

Run in development (two terminals):

```bash
cd server && npm run dev     # http://localhost:3001
cd client && npm run dev     # http://localhost:5173
```

For production, build the client and let the server serve it:

```bash
cd client && npm run build
cd ../server && npm start
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MASTER_KEY` | yes | 64 hex chars. Encrypts stored bank credentials |
| `DB_PATH` | yes | SQLite file path |
| `PORT` | no | Defaults to 3001 |
| `LLM_PROVIDER` | for chat | `anthropic` or `gemini` |
| `LLM_API_KEY` | for chat | Provider API key |
| `LLM_MODEL` | no | Defaults per provider |
| `SYNC_CRON` | no | Defaults to `0 3 * * *`, Asia/Jerusalem |
| `ENABLE_SCHEDULER` | no | Set `true` to enable the nightly sync |

## Deployment

`deploy/` contains a systemd unit with `NoNewPrivileges`, `ProtectSystem=strict` and
`ProtectHome`, and `backup.sh`, which uses `sqlite3 .backup` for a consistent snapshot under WAL
mode with 14-day retention.

## Known limitations

- Sessions are in-memory, so a server restart logs the user out.
- The OTP bridge is in-memory and does not survive a restart.
- A nightly scheduled sync can stall on an OTP prompt with nobody at the screen; the job times
  out after 180 seconds and is marked failed. This is expected and does not block the next run.
- `resetStuckJobs` cannot abort a scrape that is genuinely still in flight; the original run may
  still write a terminal status afterwards.
- Supported providers are limited to those wired in `scraper.js`: Leumi, Hapoalim, Discount, Max,
  Isracard and Cal.
- There is no test suite.
