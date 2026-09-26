# Deployment (Railway)

The app runs as a single Railway service: the Express server in `server/` serves the API and
the built React client from `client/dist`. There is no root `package.json`, so the build and
start commands below are set explicitly in the service settings.

## Before going live

A Railway URL is on the public internet. The previous setup was reachable only over Tailscale
behind a firewall, and some code still assumes that:

- **Session cookie has no `Secure` flag** (`server/src/routes/auth.js`, `sessionCookie`). Railway
  serves HTTPS, so the flag should be added before real use.
- **Sessions are in memory** and the SQLite database is a single file: run exactly **one**
  replica, and expect every redeploy to log users out.

## One-time setup

1. **Create the service**: New Project -> Deploy from GitHub repo -> pick this repo and the
   branch to deploy. Leave the root directory as the repo root.
2. **Add a volume** for the database, e.g. mounted at `/data`. Without one, the SQLite file lives
   in the container and is wiped on every deploy.
3. **Build and start commands** (Settings -> Build / Deploy):
   ```
   Build: npm ci --prefix client && npm run build --prefix client && npm ci --prefix server
   Start: npm start --prefix server
   ```
4. **Variables** (next section), then deploy.
5. **Create the first user** from a Railway shell (`railway ssh`, or the service's shell):
   ```
   cd server && node scripts/create-user.js <email> '<password, 10+ chars>' [username]
   ```
   Users created this way are marked email-verified. Everyone else signs up at `/signup`.
6. **Set `APP_URL`** to the service's public URL once Railway assigns it, so links in emails work.

## Variables

| Variable | Required | Notes |
|---|---|---|
| `MASTER_KEY` | yes | 64 hex chars (AES-256-GCM key for bank credentials). `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Losing it makes stored bank credentials unreadable. |
| `DB_PATH` | yes | On the volume, e.g. `/data/data.db`. Created with its schema on first start. |
| `TZ` | yes | `Asia/Jerusalem`. Month/day analytics group by SQLite `'localtime'`, which follows this; without it the container's UTC clock shifts month boundaries. |
| `APP_URL` | yes | Public base URL, no trailing slash needed, e.g. `https://<service>.up.railway.app`. Used in verification and reset links. |
| `RESEND_API_KEY` | yes | From resend.com/api-keys. |
| `EMAIL_FROM` | yes | Sender, e.g. `Dashboard <noreply@yourdomain.com>`. Must be a Resend-verified domain; `onboarding@resend.dev` only delivers to your own Resend account email. |
| `LLM_PROVIDER` | for AI features | `anthropic` or `gemini` (chat, insights, AI categorization). |
| `LLM_API_KEY` | for AI features | Provider API key. |
| `LLM_MODEL` | no | Defaults per provider. |
| `ENABLE_SCHEDULER` | no | `true` to run the nightly bank sync. |
| `SYNC_CRON` | no | Defaults to `0 3 * * *`. |
| `PORT` | no | Set by Railway automatically; don't override. |

## After deploying, verify

1. `GET /api/health` returns `{"status":"ok","db":true}` without logging in.
2. **Time zone** took effect, from the Railway shell:
   ```
   cd server && node -e "console.log(Intl.DateTimeFormat().resolvedOptions().timeZone, require('better-sqlite3')(':memory:').prepare(\"SELECT datetime('2026-08-31T21:21:15Z','localtime') t\").get().t)"
   ```
   Expect `Asia/Jerusalem 2026-09-01 00:21:15`. If the second value is `2026-08-31 21:21:15`, the
   image lacks time zone data and month boundaries will be off by up to 3 hours.
3. Fresh browser, no cookie: every route redirects to `/login`; `GET /api/transactions` returns 401.
4. Sign up, receive the verification email, and the link opens the deployed app (checks `APP_URL`
   and `EMAIL_FROM`).
5. Wrong password 5 times gives 429; correct login works after the lockout window.
6. A deep link such as `/subscriptions` refreshes correctly (SPA fallback).
7. **Bank sync** runs end to end. `israeli-bank-scrapers` drives a headless Chromium, which needs
   system libraries the default Railway image may not include; if the scrape fails to launch the
   browser, the build image needs Chromium's dependencies added.
8. Redeploy: data survives (volume works) and you're asked to log in again (in-memory sessions).

## Backups

`backup.sh` makes a WAL-safe SQLite snapshot with 14-day retention (`DB_PATH`, `BACKUP_DIR`,
`RETENTION_DAYS` override its defaults). It needs the `sqlite3` CLI, and Railway has no cron in
the service itself, so on Railway it is a manual tool at best. Keep a separate backup of the
volume, or a periodic copy of `data.db`, and store `MASTER_KEY` outside Railway as well.
