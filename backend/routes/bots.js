const express = require('express');
const router = express.Router();
const {
  createBot,
  getUserBots,
  getBot,
  startBot,
  stopBot,
  deleteBot,
  updateBot,
  performSelfAnalysis,
  BOT_CONFIG
} = require('../services/tradingBots');
const { STRATEGIES } = require('../services/backtesting');

router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const bots = await getUserBots(userId);
    res.json(bots);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const botId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const bot = await getBot(botId, userId);

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    res.json(bot);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const bot = await createBot(userId, req.body);
    res.status(201).json(bot);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/start', async (req, res) => {
  try {
    const userId = req.user?.id;
    const botId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await startBot(botId, userId);
    res.json(result);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/stop', async (req, res) => {
  try {
    const userId = req.user?.id;
    const botId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await stopBot(botId, userId);
    res.json(result);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const botId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const bot = await updateBot(botId, userId, req.body);
    res.json(bot);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const botId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await deleteBot(botId, userId);
    res.json(result);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/analyze', async (req, res) => {
  try {
    const userId = req.user?.id;
    const botId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const bot = await getBot(botId, userId);
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    const analysis = await performSelfAnalysis(botId);
    res.json(analysis);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/meta/strategies', (req, res) => {
  const strategies = Object.entries(STRATEGIES).map(([key, value]) => ({
    id: key,
    name: value.name,
    description: value.description,
    params: value.params
  }));

  res.json(strategies);
});

router.get('/meta/config', (req, res) => {
  res.json({
    maxBotsPerUser: BOT_CONFIG.maxBotsPerUser,
    minCapital: BOT_CONFIG.minCapital,
    maxLeverage: BOT_CONFIG.maxLeverage,
    defaultRiskPerTrade: BOT_CONFIG.defaultRiskPerTrade
  });
});

module.exports = router;
