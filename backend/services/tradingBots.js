const db = require('../config/database');
const { selfAnalysis, reasoningAnalysis, quickAnalysis } = require('../utils/groqKeys');
const { runBacktest, STRATEGIES } = require('./backtesting');

const BOT_CONFIG = {
  defaultCheckInterval: 60000, // раз в минуту проверяем сигналы
  maxBotsPerUser: 5,
  minCapital: 100,
  maxLeverage: 10,
  defaultRiskPerTrade: 2, // процент капитала на сделку
  selfAnalysisInterval: 24 * 60 * 60 * 1000 // самоанализ раз в сутки
};

const activeBots = new Map();

async function createBot(userId, options) {
  const {
    name,
    symbol,
    strategy,
    params = {},
    capital = 5000,
    leverage = 1,
    riskPerTrade = BOT_CONFIG.defaultRiskPerTrade,
    autoOptimize = true
  } = options;

  if (!name || name.length < 3) {
    throw new Error('Bot name must be at least 3 characters');
  }

  if (!symbol) {
    throw new Error('Symbol is required');
  }

  if (!strategy || !STRATEGIES[strategy]) {
    throw new Error(`Invalid strategy. Available: ${Object.keys(STRATEGIES).join(', ')}`);
  }

  if (capital < BOT_CONFIG.minCapital) {
    throw new Error(`Minimum capital is $${BOT_CONFIG.minCapital}`);
  }

  if (leverage > BOT_CONFIG.maxLeverage) {
    throw new Error(`Maximum leverage is ${BOT_CONFIG.maxLeverage}x`);
  }

  const existingBots = await db.getMany(
    'SELECT COUNT(*) as count FROM trading_bots WHERE user_id = $1',
    [userId]
  );

  if (parseInt(existingBots[0]?.count || 0) >= BOT_CONFIG.maxBotsPerUser) {
    throw new Error(`Maximum ${BOT_CONFIG.maxBotsPerUser} bots per user`);
  }

  // прогоняем бэктест за 30 дней перед созданием — если 0 сигналов, стратегия мертвая
  const backtestResult = await runBacktest({
    symbol,
    interval: '1h',
    days: 30,
    strategyName: strategy,
    capital,
    leverage,
    params
  });

  if (backtestResult.tradesCount === 0) {
    throw new Error('Strategy generated no signals in last 30 days. Try different parameters.');
  }

  const result = await db.query(
    `INSERT INTO trading_bots
     (user_id, name, symbol, strategy, params, capital, leverage, status,
      total_trades, win_rate, roi, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
     RETURNING id`,
    [
      userId,
      name,
      symbol,
      strategy,
      JSON.stringify({ ...params, riskPerTrade, autoOptimize }),
      capital,
      leverage,
      'stopped',
      backtestResult.tradesCount,
      backtestResult.metrics.winRate,
      backtestResult.metrics.roi
    ]
  );

  const botId = result.rows[0].id;

  console.log(` Bot created: ${name} (${symbol} ${strategy})`);

  return {
    id: botId,
    name,
    symbol,
    strategy,
    capital,
    leverage,
    initialMetrics: backtestResult.metrics
  };
}

async function getUserBots(userId) {
  const bots = await db.getMany(
    `SELECT * FROM trading_bots WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  return bots.map(bot => ({
    ...bot,
    params: typeof bot.params === 'string' ? JSON.parse(bot.params || '{}') : (bot.params || {})
  }));
}

async function getBot(botId, userId) {
  const bot = await db.getOne(
    'SELECT * FROM trading_bots WHERE id = $1 AND user_id = $2',
    [botId, userId]
  );

  if (!bot) return null;

  return {
    ...bot,
    params: typeof bot.params === 'string' ? JSON.parse(bot.params || '{}') : (bot.params || {})
  };
}

async function startBot(botId, userId) {
  const bot = await getBot(botId, userId);

  if (!bot) {
    throw new Error('Bot not found');
  }

  if (bot.status === 'running') {
    throw new Error('Bot is already running');
  }

  await db.query(
    'UPDATE trading_bots SET status = $1 WHERE id = $2',
    ['running', botId]
  );

  activeBots.set(botId, {
    interval: null,
    lastRun: null,
    trades: [],
    stats: {
      totalTrades: bot.total_trades,
      wins: 0,
      losses: 0
    }
  });

  scheduleBot(bot);

  console.log(` Bot started: ${bot.name}`);

  return { status: 'running', botId };
}

async function stopBot(botId, userId) {
  const bot = await getBot(botId, userId);

  if (!bot) {
    throw new Error('Bot not found');
  }

  await db.query(
    'UPDATE trading_bots SET status = $1 WHERE id = $2',
    ['stopped', botId]
  );

  const activeBot = activeBots.get(botId);
  if (activeBot?.interval) {
    clearInterval(activeBot.interval);
  }
  activeBots.delete(botId);

  console.log(`Bot stopped: ${bot.name}`);

  return { status: 'stopped', botId };
}

async function deleteBot(botId, userId) {

  try {
    await stopBot(botId, userId);
  } catch (e) {

  }

  await db.query('DELETE FROM trading_bots WHERE id = $1 AND user_id = $2', [botId, userId]);

  console.log(` Bot deleted: ${botId}`);

  return { deleted: true, botId };
}

async function updateBot(botId, userId, updates) {
  const bot = await getBot(botId, userId);

  if (!bot) {
    throw new Error('Bot not found');
  }

  if (bot.status === 'running') {
    throw new Error('Stop bot before updating');
  }

  const allowedUpdates = ['name', 'capital', 'leverage', 'params'];
  const updateFields = [];
  const updateValues = [botId, userId];
  let paramIndex = 3;

  for (const [key, value] of Object.entries(updates)) {
    if (allowedUpdates.includes(key)) {
      if (key === 'params') {
        updateFields.push(`params = $${paramIndex}`);
        updateValues.push(JSON.stringify({ ...bot.params, ...value }));
      } else {
        updateFields.push(`${key} = $${paramIndex}`);
        updateValues.push(value);
      }
      paramIndex++;
    }
  }

  if (updateFields.length === 0) {
    throw new Error('No valid updates provided');
  }

  await db.query(
    `UPDATE trading_bots SET ${updateFields.join(', ')} WHERE id = $1 AND user_id = $2`,
    updateValues
  );

  return getBot(botId, userId);
}

function scheduleBot(bot) {
  const botId = bot.id;
  const activeBot = activeBots.get(botId);

  if (!activeBot) return;

  activeBot.interval = setInterval(async () => {
    try {
      await executeBot(bot);
    } catch (error) {
      console.error(`Bot ${botId} execution error:`, error.message);
    }
  }, BOT_CONFIG.defaultCheckInterval);

  executeBot(bot).catch(e => console.error('Initial bot execution error:', e.message));
}

async function executeBot(bot) {
  const botId = bot.id;
  const activeBot = activeBots.get(botId);

  if (!activeBot) return;

  const now = Date.now();

  // дебаунс — не чаще раза в минуту, binance забанит по IP если спамить
  if (activeBot.lastRun && now - activeBot.lastRun < 60000) {
    return;
  }

  activeBot.lastRun = now;

  try {

    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${bot.symbol}&interval=1h&limit=100`
    );
    const klines = await response.json();

    if (!Array.isArray(klines)) {
      console.error(`Bot ${botId}: Invalid klines data`);
      return;
    }

    const { calculateIndicators } = require('./backtesting');
    const indicators = calculateIndicators(klines.map(k => ({
      timestamp: k[0],
      openTime: new Date(k[0]),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      closeTime: new Date(k[6])
    })));

    const strategy = STRATEGIES[bot.strategy];
    if (!strategy) {
      console.error(`Bot ${botId}: Unknown strategy ${bot.strategy}`);
      return;
    }

    const signals = strategy.generateSignals(
      klines.map(k => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      })),
      indicators,
      bot.params
    );

    if (signals.length === 0) return;

    const lastSignal = signals[signals.length - 1];

    const lastCandleIndex = klines.length - 1;
    if (lastSignal.index < lastCandleIndex - 1) {
      return;
    }

    const openTrades = await db.getMany(
      `SELECT * FROM trades
       WHERE user_id = $1 AND status = 'open' AND pair = $2
       AND metadata->>'bot_id' = $3`,
      [bot.user_id, bot.symbol, botId.toString()]
    );

    if (openTrades.length > 0) {

      await checkExitSignal(bot, openTrades[0], lastSignal, indicators);
      return;
    }

    await executeTrade(bot, lastSignal, klines[klines.length - 1]);

    activeBot.stats.totalTrades++;

    await db.query(
      `UPDATE trading_bots
       SET last_run = CURRENT_TIMESTAMP, total_trades = $1
       WHERE id = $2`,
      [activeBot.stats.totalTrades, botId]
    );

  } catch (error) {
    console.error(`Bot ${botId} execution error:`, error);
  }
}

async function executeTrade(bot, signal, currentCandle) {
  const direction = signal.type;
  const entryPrice = parseFloat(currentCandle[4]);
  const size = (bot.capital * (bot.params.riskPerTrade || 2) / 100) / entryPrice;

  const result = await db.query(
    `INSERT INTO trades
     (pair, direction, quantity, entry_price, tp, sl, user_id, status, opened_at, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', CURRENT_TIMESTAMP, $8)
     RETURNING id`,
    [
      bot.symbol,
      direction.toLowerCase(),
      size,
      entryPrice,
      signal.takeProfit,
      signal.stopLoss,
      bot.user_id,
      JSON.stringify({
        bot_id: bot.id,
        bot_name: bot.name,
        strategy: bot.strategy,
        signal_reason: signal.reason,
        signal_confidence: signal.confidence
      })
    ]
  );

  const tradeId = result.rows[0].id;

  console.log(` Bot ${bot.name}: ${direction} ${bot.symbol} @ $${entryPrice.toFixed(2)}`);

  try {
    const telegram = require('./telegram');
    await telegram.sendTradeNotification(bot.user_id, {
      pair: bot.symbol,
      direction: direction.toLowerCase(),
      entry_price: entryPrice,
      pnl: 0
    });
  } catch (e) {

  }

  return tradeId;
}

async function checkExitSignal(bot, trade, signal, indicators) {
  const currentPrice = signal.price;

  if (trade.direction === 'long') {
    if (currentPrice >= trade.tp) {
      await closeTrade(bot, trade, currentPrice, 'Take Profit');
    } else if (currentPrice <= trade.sl) {
      await closeTrade(bot, trade, currentPrice, 'Stop Loss');
    }
  } else {
    if (currentPrice <= trade.tp) {
      await closeTrade(bot, trade, currentPrice, 'Take Profit');
    } else if (currentPrice >= trade.sl) {
      await closeTrade(bot, trade, currentPrice, 'Stop Loss');
    }
  }

  // реверс — закрываем позу если пришёл сильный обратный сигнал (conf >= 80)
  const isReverseSignal = (trade.direction === 'long' && signal.type === 'SELL') ||
                          (trade.direction === 'short' && signal.type === 'BUY');

  if (isReverseSignal && signal.confidence >= 80) {
    await closeTrade(bot, trade, currentPrice, 'Reverse Signal');
  }
}

async function closeTrade(bot, trade, exitPrice, reason) {
  const pnl = trade.direction === 'long'
    ? (exitPrice - trade.entry_price) * trade.quantity
    : (trade.entry_price - exitPrice) * trade.quantity;

  await db.query(
    `UPDATE trades
     SET status = 'closed', close_price = $1, pnl = $2, closed_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [exitPrice, pnl, trade.id]
  );

  const activeBot = activeBots.get(bot.id);
  if (activeBot) {
    if (pnl > 0) {
      activeBot.stats.wins++;
    } else {
      activeBot.stats.losses++;
    }

    const winRate = (activeBot.stats.wins / (activeBot.stats.wins + activeBot.stats.losses)) * 100;

    await db.query(
      `UPDATE trading_bots
       SET total_trades = total_trades + 1,
           win_rate = $1,
           roi = roi + $2
       WHERE id = $3`,
      [winRate, pnl > 0 ? pnl / bot.capital * 100 : pnl / bot.capital * 100, bot.id]
    );
  }

  console.log(` Bot ${bot.name}: Closed ${trade.pair} @ $${exitPrice.toFixed(2)} (${reason}) PnL: $${pnl.toFixed(2)}`);

  try {
    const telegram = require('./telegram');
    await telegram.sendTradeNotification(bot.user_id, {
      pair: bot.symbol,
      direction: trade.direction,
      entry_price: trade.entry_price,
      close_price: exitPrice,
      pnl
    });
  } catch (e) {

  }

  return { closed: true, pnl, reason };
}

async function performSelfAnalysis(botId) {
  const bot = await db.getOne('SELECT * FROM trading_bots WHERE id = $1', [botId]);

  if (!bot) return null;

  const trades = await db.getMany(
    `SELECT * FROM trades
     WHERE metadata->>'bot_id' = $1
     ORDER BY opened_at DESC
     LIMIT 50`,
    [botId.toString()]
  );

  if (trades.length < 5) {
    return { message: 'Not enough trades for self-analysis' };
  }

  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;

  const metrics = {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: (wins.length / trades.length) * 100,
    totalPnl,
    avgWin,
    avgLoss,
    profitFactor: avgLoss > 0 ? avgWin / avgLoss : 0
  };

  const analysis = await selfAnalysis(trades.map(t => ({
    pair: t.pair,
    direction: t.direction,
    entry: t.entry_price,
    exit: t.close_price,
    pnl: t.pnl,
    result: t.pnl > 0 ? 'win' : 'loss'
  })), metrics);

  const aiContent = analysis?.choices?.[0]?.message?.content;

  const suggestions = extractOptimizationSuggestions(aiContent);

  if (bot.params?.autoOptimize && suggestions.length > 0) {
    await applyOptimizations(bot, suggestions);
  }

  return {
    metrics,
    aiAnalysis: aiContent,
    suggestions,
    autoApplied: bot.params?.autoOptimize
  };
}

// парсим AI-ответ регулярками — хрупко, но работает для структурированных ответов
function extractOptimizationSuggestions(aiContent) {
  const suggestions = [];

  if (!aiContent) return suggestions;

  const patterns = [
    { regex: /EMA.*?(\d+).*?EMA.*?(\d+)/i, params: ['fastPeriod', 'slowPeriod'] },
    { regex: /RSI.*?период.*?(\d+)/i, params: ['period'] },
    { regex: /stop.?loss.*?(\d+\.?\d*)%/i, params: ['slMultiplier'] },
    { regex: /take.?profit.*?(\d+\.?\d*)/i, params: ['tpMultiplier'] }
  ];

  for (const { regex, params } of patterns) {
    const match = aiContent.match(regex);
    if (match) {
      for (let i = 0; i < params.length; i++) {
        if (match[i + 1]) {
          suggestions.push({
            param: params[i],
            value: parseFloat(match[i + 1]),
            reason: `AI suggestion from analysis`
          });
        }
      }
    }
  }

  return suggestions;
}

async function applyOptimizations(bot, suggestions) {
  const newParams = { ...bot.params };

  for (const suggestion of suggestions) {
    if (suggestion.param && !isNaN(suggestion.value)) {
      newParams[suggestion.param] = suggestion.value;
    }
  }

  await db.query(
    'UPDATE trading_bots SET params = $1 WHERE id = $2',
    [JSON.stringify(newParams), bot.id]
  );

  console.log(` Bot ${bot.name}: Auto-optimized params: ${JSON.stringify(newParams)}`);
}

async function initializeBotScheduler() {
  console.log('Starting bot scheduler...');

  const runningBots = await db.getMany(
    "SELECT * FROM trading_bots WHERE status = 'running'"
  );

  for (const bot of runningBots) {
    bot.params = typeof bot.params === 'string' ? JSON.parse(bot.params || '{}') : (bot.params || {});
    scheduleBot(bot);
    activeBots.set(bot.id, {
      interval: null,
      lastRun: null,
      trades: [],
      stats: { totalTrades: bot.total_trades, wins: 0, losses: 0 }
    });
  }

  console.log(` ${runningBots.length} bots started`);

  setInterval(async () => {
    for (const [botId] of activeBots) {
      try {
        await performSelfAnalysis(botId);
      } catch (e) {
        console.error(`Self-analysis error for bot ${botId}:`, e.message);
      }
    }
  }, BOT_CONFIG.selfAnalysisInterval);
}

module.exports = {
  BOT_CONFIG,
  createBot, getUserBots, getBot,
  startBot, stopBot, deleteBot, updateBot,
  executeBot, performSelfAnalysis,
  initializeBotScheduler
};
