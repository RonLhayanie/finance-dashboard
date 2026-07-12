# Deployment (Ubuntu + Tailscale)

```bash
# One-time
sudo useradd --system --home /opt/fable --shell /usr/sbin/nologin fable
sudo mkdir -p /opt/fable/data /opt/fable/backups /opt/fable/data/chromium-home
# copy repo to /opt/fable, npm ci in server/, npm ci && npm run build in client/
sudo chown -R fable:fable /opt/fable
sudo chmod 600 /opt/fable/server/.env       # holds MASTER_KEY and LLM_API_KEY

# .env on this box: DB_PATH=/opt/fable/data/data.db, ENABLE_SCHEDULER=true

# Create the login user
cd /opt/fable/server && sudo -u fable node scripts/create-user.js ron '<strong password>'

# Service
sudo cp /opt/fable/deploy/fable.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now fable

# Backups
chmod +x /opt/fable/deploy/backup.sh
# add cron line from the header of backup.sh (crontab -u fable -e)

# Firewall: nothing public
sudo ufw default deny incoming
sudo ufw allow in on tailscale0
sudo ufw enable
```

Access from any of your Tailscale devices: http://<tailscale-ip>:3001

## Verification checklist

1. Fresh browser, no cookie: every route redirects to /login; direct GET /api/transactions returns 401.
2. Wrong password 5 times -> 429 with the lockout message; correct login after 15 min works.
3. Correct login -> dashboard loads, cookie is HttpOnly (visible in devtools > Application, not readable via document.cookie).
4. Logout -> cookie cleared, protected routes redirect to /login again.
5. npm run build in client/, then hitting the server root serves the built app; deep link like /subscriptions refreshes correctly (SPA fallback).
6. /api/health still works unauthenticated (needed for uptime checks).
7. Server restart: user is logged out (in-memory sessions) and can log back in.
8. backup.sh run manually produces a dated .db file that opens in sqlite3.
