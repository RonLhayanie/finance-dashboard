require('dotenv').config({ quiet: true });

const path = require('path');
const express = require('express');
const cors = require('cors');

const db = require('./db/db');
require('./crypto/vault');
const syncRouter = require('./routes/sync');
const analyticsRouter = require('./routes/analytics');
const subscriptionsRouter = require('./routes/subscriptions');
const chatRouter = require('./routes/chat');
const accountsRouter = require('./routes/accounts');
const transactionsRouter = require('./routes/transactions');
const authRouter = require('./routes/auth');
const userRouter = require('./routes/user');
const { requireAuth } = require('./auth/middleware');
const { startScheduler } = require('./scheduler');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Railway puts one proxy in front of the app; without this, req.ip is the
// proxy for every visitor and rate limits/lockouts become global. Only in
// production: locally there's no proxy, so X-Forwarded-For would be spoofable.
if (isProduction) app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
      "font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  );
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Public
app.get('/api/health', (req, res) => {
  db.prepare('SELECT 1').get();
  res.json({ status: 'ok', db: true });
});
app.use('/api/auth', authRouter);

// Everything else under /api requires a session
app.use('/api', requireAuth);

app.use('/api/sync', syncRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/user', userRouter);

// Serve the built client and let the SPA handle client-side routes.
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));

// SPA fallback. Deliberately not app.get('*') - that syntax throws under
// Express 5's path-to-regexp. This middleware form works on both Express 4 and 5.
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Body-parser errors carry their own 4xx status; anything else is a server
// error. Either way the client gets a fixed message; details stay in the log.
const CLIENT_ERRORS = { 400: 'Invalid request body', 413: 'Request body too large' };
app.use((err, req, res, next) => {
  const status = CLIENT_ERRORS[err.status] ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: CLIENT_ERRORS[status] || 'Internal server error' });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);

  if (process.env.ENABLE_SCHEDULER === 'true') {
    startScheduler();
  }
});
