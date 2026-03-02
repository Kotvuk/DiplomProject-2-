require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./config/database');

const { authMiddleware, requireAdmin } = require('./middleware/auth');
const { metricsMiddleware, metricsEndpoint } = require('./middleware/metrics');

const app = express();
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);
app.use(authMiddleware);

app.get('/api/health', async (req, res) => {
  try {

    await db.query('SELECT 1');
    res.json({
      status: 'ok',
      database: 'connected',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: e.message
    });
  }
});

app.get('/metrics', requireAdmin, metricsEndpoint);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/market'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/trades', require('./routes/trades'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/watchlist', require('./routes/watchlist'));
app.use('/api/whale', require('./routes/whale'));
app.use('/api/news', require('./routes/news'));
app.use('/api/signals', require('./routes/signals'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/download-project', require('./routes/download'));
app.use('/api/export', require('./routes/export'));

app.use('/api/backtest', require('./routes/backtest'));
app.use('/api/bots', require('./routes/bots'));

app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/sentiment', require('./routes/sentiment'));
app.use('/api/push', require('./routes/push'));

const distPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend not built. Run: cd frontend && npx vite build');
  }
});

async function initializeServices() {
  console.log('Initializing services...');

  try {
    const telegram = require('./services/telegram');
    telegram.startPolling();
    console.log('Telegram bot initialized');
  } catch (error) {
    console.warn('Telegram bot not initialized:', error.message);
  }

  try {
    const { initializeBotScheduler } = require('./services/tradingBots');
    await initializeBotScheduler();
    console.log('Trading bot scheduler initialized');
  } catch (error) {
    console.warn('Trading bot scheduler not initialized:', error.message);
  }
}

module.exports = { app, initializeServices };
