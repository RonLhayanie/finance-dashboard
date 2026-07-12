require('dotenv').config();

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
const { requireAuth } = require('./auth/middleware');
const { startScheduler } = require('./scheduler');

const app = express();

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

// Serve the built client and let the SPA handle client-side routes.
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));

// SPA fallback. Deliberately not app.get('*') - that syntax throws under
// Express 5's path-to-regexp. This middleware form works on both Express 4 and 5.
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);

  if (process.env.ENABLE_SCHEDULER === 'true') {
    startScheduler();
  }
});
