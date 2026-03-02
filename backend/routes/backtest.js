const express = require('express');
const router = express.Router();
const {
  runBacktest,
  getBacktestHistory,
  getAIBacktestAnalysis,
  optimizeStrategy,
  STRATEGIES,
  BACKTEST_CONFIG
} = require('../services/backtesting');
const { ALLOWED_SYMBOLS } = require('../utils/symbols');

const ALLOWED_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'];

router.get('/strategies', (req, res) => {
  const strategies = Object.entries(STRATEGIES).map(([key, value]) => ({
    id: key,
    name: value.name,
    description: value.description,
    params: value.params
  }));

  res.json(strategies);
});

router.post('/run', async (req, res) => {
  try {
    const {
      symbol,
      interval,
      days,
      strategy,
      capital,
      leverage,
      riskPerTrade,
      params
    } = req.body;

    if (!symbol || !ALLOWED_SYMBOLS.includes(symbol)) {
      return res.status(400).json({
        error: 'Invalid symbol',
        allowedSymbols: ALLOWED_SYMBOLS
      });
    }

    if (interval && !ALLOWED_INTERVALS.includes(interval)) {
      return res.status(400).json({
        error: 'Invalid interval',
        allowedIntervals: ALLOWED_INTERVALS
      });
    }

    if (!strategy || !STRATEGIES[strategy]) {
      return res.status(400).json({
        error: 'Invalid strategy',
        availableStrategies: Object.keys(STRATEGIES)
      });
    }

    const result = await runBacktest({
      symbol,
      interval: interval || '1h',
      days: parseInt(days) || 90,
      strategyName: strategy,
      capital: parseFloat(capital) || BACKTEST_CONFIG.defaultCapital,
      leverage: parseFloat(leverage) || 1,
      riskPerTrade: parseFloat(riskPerTrade) || BACKTEST_CONFIG.riskPerTrade,
      params,
      userId: req.user?.id
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/run-with-analysis', async (req, res) => {
  try {
    const {
      symbol,
      interval,
      days,
      strategy,
      capital,
      leverage,
      riskPerTrade,
      params
    } = req.body;

    if (!symbol || !ALLOWED_SYMBOLS.includes(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol' });
    }

    if (!strategy || !STRATEGIES[strategy]) {
      return res.status(400).json({ error: 'Invalid strategy' });
    }

    const result = await runBacktest({
      symbol,
      interval: interval || '1h',
      days: parseInt(days) || 90,
      strategyName: strategy,
      capital: parseFloat(capital) || BACKTEST_CONFIG.defaultCapital,
      leverage: parseFloat(leverage) || 1,
      riskPerTrade: parseFloat(riskPerTrade) || BACKTEST_CONFIG.riskPerTrade,
      params,
      userId: req.user?.id
    });

    const aiAnalysis = await getAIBacktestAnalysis(result);

    res.json({
      ...result,
      aiAnalysis
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit) || 20;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const history = await getBacktestHistory(userId, limit);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/optimize', async (req, res) => {
  try {
    const {
      symbol,
      interval,
      days,
      strategy,
      paramRanges
    } = req.body;

    if (!symbol || !ALLOWED_SYMBOLS.includes(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol' });
    }

    if (!strategy || !STRATEGIES[strategy]) {
      return res.status(400).json({ error: 'Invalid strategy' });
    }

    const result = await optimizeStrategy(
      strategy,
      symbol,
      interval || '1h',
      days || 90,
      paramRanges
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// quick — гоняет все стратегии за 30 дней и сортирует по ROI
router.post('/quick', async (req, res) => {
  try {
    const { symbol } = req.body;

    if (!symbol || !ALLOWED_SYMBOLS.includes(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol' });
    }

    const results = [];

    for (const strategyName of Object.keys(STRATEGIES)) {
      try {
        const result = await runBacktest({
          symbol,
          interval: '1h',
          days: 30,
          strategyName,
          capital: 5000,
          userId: req.user?.id
        });

        results.push({
          strategy: strategyName,
          strategyName: result.strategyName,
          winRate: result.metrics.winRate,
          roi: result.metrics.roi,
          profitFactor: result.metrics.profitFactor,
          tradesCount: result.tradesCount
        });
      } catch (err) {
        console.error(`Quick backtest error for ${strategyName}:`, err.message);
      }
    }

    results.sort((a, b) => b.roi - a.roi);

    res.json({
      symbol,
      results,
      bestStrategy: results[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/symbols', (req, res) => {
  res.json({
    symbols: ALLOWED_SYMBOLS,
    intervals: ALLOWED_INTERVALS
  });
});

router.get('/config', (req, res) => {
  res.json({
    defaultCapital: BACKTEST_CONFIG.defaultCapital,
    defaultPeriod: BACKTEST_CONFIG.defaultPeriod,
    feePercent: BACKTEST_CONFIG.feePercent,
    maxPositions: BACKTEST_CONFIG.maxPositions,
    riskPerTrade: BACKTEST_CONFIG.riskPerTrade
  });
});

module.exports = router;
