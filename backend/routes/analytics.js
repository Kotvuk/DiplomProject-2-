const express = require('express');
const router = express.Router();
const analytics = require('../services/analytics');

router.get('/pnl/history', async (req, res) => {
  try {
    var userId = req.user?.id;
    const { period = 'month', limit = 12 } = req.query;

    var result = await analytics.getPnLHistory(userId, period, parseInt(limit));
    res.json(result);

  } catch (e) {
    console.error('P&L history error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/pnl/daily', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { days = 30 } = req.query;

    const result = await analytics.getDailyPnL(userId, parseInt(days));
    res.json(result);

  } catch (e) {
    console.error('Daily P&L error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/risk/var', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { confidence = 0.95 } = req.query;

    const result = await analytics.calculateVaR(userId, parseFloat(confidence));
    res.json(result);

  } catch (e) {
    console.error('VaR calculation error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/risk/sharpe', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { riskFreeRate = 0.04 } = req.query;

    const result = await analytics.calculateSharpeRatio(userId, parseFloat(riskFreeRate));
    res.json(result);

  } catch (e) {
    console.error('Sharpe ratio error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/risk/drawdown', async (req, res) => {
  try {
    const userId = req.user?.id;

    const result = await analytics.calculateMaxDrawdown(userId);
    res.json(result);

  } catch (e) {
    console.error('Drawdown calculation error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/risk/overview', async (req, res) => {
  try {
    const userId = req.user?.id;

    var [var95, var99, sharpe, drawdown] = await Promise.all([
      analytics.calculateVaR(userId, 0.95),
      analytics.calculateVaR(userId, 0.99),
      analytics.calculateSharpeRatio(userId),
      analytics.calculateMaxDrawdown(userId)
    ]);

    res.json({
      var_95: var95,
      var_99: var99,
      sharpe_metrics: sharpe,
      drawdown: drawdown
    });

  } catch (e) {
    console.error('Risk overview error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/correlation', async (req, res) => {
  try {
    const userId = req.user?.id;

    const result = await analytics.getCorrelationMatrix(userId);
    res.json(result);

  } catch (e) {
    console.error('Correlation matrix error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/attribution', async (req, res) => {
  try {
    const userId = req.user?.id;

    const result = await analytics.getPerformanceAttribution(userId);
    res.json(result);

  } catch (e) {
    console.error('Performance attribution error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user?.id;

    const [dailyPnL, riskOverview, correlation, attribution] = await Promise.all([
      analytics.getDailyPnL(userId, 30),
      Promise.all([
        analytics.calculateVaR(userId, 0.95),
        analytics.calculateSharpeRatio(userId),
        analytics.calculateMaxDrawdown(userId)
      ]),
      analytics.getCorrelationMatrix(userId),
      analytics.getPerformanceAttribution(userId)
    ]);

    res.json({
      daily_pnl: dailyPnL,
      risk_metrics: {
        var_95: riskOverview[0],
        sharpe: riskOverview[1],
        drawdown: riskOverview[2]
      },
      correlation_matrix: correlation,
      performance_attribution: attribution,
      last_updated: new Date().toISOString()
    });

  } catch (e) {
    console.error('Analytics dashboard error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
