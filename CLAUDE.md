# Fable — Personal Financial Dashboard

## Agent Working Rules

Read these first. They exist because ignoring them cost 8 hours and 733k tokens.

1. **Stay in scope.** Only modify files explicitly listed in the prompt. If you find a bug elsewhere, report it — do not fix it.
2. **Do not self-verify.** Do not run the server, run builds, or write test scripts unless explicitly asked. The human verifies; you write.
3. **Never touch working code to chase an unrelated failure.** A broken model name is not a license to rewrite the tool-calling layer.
4. **Project root is `C:\dev\finance-dashboard`.** Ignore any other copy of this project on this machine.
5. Personal context file: `C:\dev\_context\ron_context.md`

## Overview

Single-user web dashboard that scrapes Israeli bank and credit-card transactions, stores them locally in SQLite, and provides spending analytics plus an AI advisor. Never exposed to the public internet — local network / Tailscale only.

## Current State (2026-07-13)

**Working, verified against live accounts:**
- Bank Discount (`discount`) — scraped successfully
- Visa CAL (`visaCal`) — scraped successfully
- Auth, encryption, sync engine, OTP state machine, frontend, analytics pipeline

**Broken:**
- AI chat (`/api/chat`) returns 502. `ai/adapter.js` and `ai/chat.js` were damaged during an unscoped agent run while chasing a retired Gemini model name. Tool-calling round-trip is the suspect.

**Known data issues:**
- Bank rows described `חיוב לכרטיס ויזה 0659` are aggregate card charges that duplicate itemized CAL purchases. They inflate spending ~2x and must be excluded from analytics.
- Timestamps display in UTC; Israel is UTC+3. Cosmetic, not blocking.

## Tech Stack

- **Runtime**: Node.js, CommonJS
- **Server**: Express — API, sync/OTP endpoints, serves the built client
- **Bank integration**: `israeli-bank-scrapers` (not raw Playwright). Providers: leumi, hapoalim, discount, max, isracard, visaCal
- **Database**: `better-sqlite3`, single local file
- **Crypto**: Node `crypto`, AES-256-GCM for credentials at rest
- **Auth**: scrypt password hashing, in-memory sessions, HttpOnly cookie
- **Frontend**: React + Vite + Tailwind + Recharts
- **AI**: provider-agnostic adapter (Gemini), tool-calling — NOT RAG. The LLM never writes SQL; it calls whitelisted functions.

## Project Structure

- `server/src/db` — connection, schema, all SQL. Nothing outside this folder touches SQL directly.
- `server/src/crypto/vault.js` — the only place a plaintext bank password exists in memory.
- `server/src/sync` — `scraper.js` (library wrapper), `otpBridge.js` (pause/resume promise), `engine.js` (state machine: RUNNING → NEEDS_OTP → DONE/FAILED)
- `server/src/analytics` — `categorize.js`, `subscriptions.js`, `anomalies.js`. Run as a post-sync hook.
- `server/src/ai` — `adapter.js`, `chat.js`, `tools.js`. Tools are validated, parameterized, read-only.
- `server/src/routes` — Express routes only. No scraping or SQL logic.
- `server/src/auth` — password, session, middleware
- `client/src` — pages, components, `hooks/useSyncStatus.js` (3s polling, active only during sync)
- `deploy/` — systemd unit, backup script

## Environment

`server/.env` — never committed:

```
PORT=3001
MASTER_KEY=<64 hex chars, 32 bytes>
DB_PATH=./data.db
LLM_PROVIDER=gemini
LLM_API_KEY=<key>
LLM_MODEL=<verify current model name before use>
SYNC_CRON=0 3 * * *
ENABLE_SCHEDULER=false
```

Note: the env var is `MASTER_KEY`, not `ENCRYPTION_KEY`.

## Running

```
cd server
npm start          # http://localhost:3001

cd client
npm run build      # server serves client/dist
npm run dev        # dev only, proxies /api to :3001
```

Create the login user:

```
cd server
node scripts/create-user.js <username> <password>
```

## Architectural Decisions

- **Library over raw Playwright**: banks change their DOM constantly; the community maintains the scrapers.
- **Tool-calling over RAG**: the data is structured SQL rows, not documents. Vector search would hallucinate numbers.
- **Polling over WebSockets**: one user, one sync a day. Polling can't silently disconnect.
- **Single-user SQLite**: revisit only if this ever becomes multi-user.
- **OTP as a state, not a failure**: the scraper pauses and awaits a promise; the frontend posts the code back.

## Tests

No suite. Verification is manual, performed by the human.