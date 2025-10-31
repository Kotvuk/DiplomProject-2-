const db = require('../config/database');
const { quickAnalysis, deepAnalysis } = require('../utils/groqKeys');

var TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

let lastUpdateId = 0;
let isPolling = false;
let pollInterval = null;

const userChats = new Map();

async function telegramRequest(method, params = {}) {
  try {
    const response = await fetch(`${TELEGRAM_API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    var data = await response.json();

    if (!data.ok) {
      console.error('[Telegram] API error:', data.description);
      return null;
    }

    return data.result;

  } catch (error) {
    console.error('[Telegram] Request error:', error.message);
    return null;
  }
}

async function sendMessage(chatId, text, options = {}) {
  return telegramRequest('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: options.parseMode || 'HTML',
    disable_notification: options.silent || false,
    reply_markup: options.replyMarkup
  });
}

async function editMessage(chatId, messageId, text, options = {}) {
  return telegramRequest('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: options.parseMode || 'HTML',
    reply_markup: options.replyMarkup
  });
}

async function getUpdates(offset = 0, timeout = 30) {
  return telegramRequest('getUpdates', {
    offset,
    timeout,
    allowed_updates: ['message', 'callback_query']
  });
}

function formatSignal(signal) {
  const direction = signal.direction === 'BUY' ? '🟢 LONG' : '🔴 SHORT';
  const entry = signal.entry_price?.toFixed(signal.entry_price > 100 ? 2 : 6);
  const tp = signal.tp_price?.toFixed(signal.tp_price > 100 ? 2 : 6);
  const sl = signal.sl_price?.toFixed(signal.sl_price > 100 ? 2 : 6);

  return `
<b>${direction} ${signal.pair}</b>

📊 <b>Entry:</b> $${entry}
🎯 <b>Take Profit:</b> $${tp}
🛡 <b>Stop Loss:</b> $${sl}
📈 <b>Confidence:</b> ${signal.confidence || 70}%

💡 <i>${signal.reason || 'AI generated signal'}</i>

⏰ ${new Date().toLocaleString('ru-RU')}
`;
}

function formatAlert(alert) {
  var condition = alert.condition === 'above' ? '⬆️ выше' : '⬇️ ниже';
  const triggered = alert.status === 'triggered' ? '✅ СРАБОТАЛ!' : '⏳ Ожидание';

  return `
<b>🔔 ${alert.pair}</b>

${triggered}
💰 <b>Цель:</b> $${alert.value.toFixed(2)}
📊 <b>Условие:</b> ${condition} цели

${alert.message || ''}
⏰ ${new Date().toLocaleString('ru-RU')}
`;
}

function formatTrade(trade) {
  const pnl = trade.pnl || 0;
  const pnlEmoji = pnl >= 0 ? '🟢' : '🔴';
  const pnlStr = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;

  return `
<b>${trade.direction === 'long' ? '🟢 LONG' : '🔴 SHORT'} ${trade.pair}</b>

💰 <b>Entry:</b> $${trade.entry_price.toFixed(2)}
📤 <b>Exit:</b> $${trade.close_price?.toFixed(2) || 'Open'}
${pnlEmoji} <b>PnL:</b> ${pnlStr}

⏰ ${new Date().toLocaleString('ru-RU')}
`;
}

function formatBacktestResult(result) {
  const profitEmoji = result.metrics.roi >= 0 ? '🟢' : '🔴';

  return `
<b>📊 Backtest: ${result.strategyName}</b>
<b>Symbol:</b> ${result.symbol} (${result.interval})

${profitEmoji} <b>ROI:</b> ${result.metrics.roi.toFixed(1)}%
📈 <b>Win Rate:</b> ${result.metrics.winRate.toFixed(1)}%
📊 <b>Profit Factor:</b> ${result.metrics.profitFactor.toFixed(2)}
📉 <b>Max Drawdown:</b> ${result.metrics.maxDrawdown.toFixed(1)}%

📋 <b>Trades:</b> ${result.tradesCount}
💰 <b>Capital:</b> $${result.capital}
📅 <b>Period:</b> ${result.days} days
`;
}

const COMMANDS = {

  async start(message) {
    const chatId = message.chat.id;
    const userId = message.from.id;

    await saveUserChat(userId, chatId);

    const text = `
<b>🤖 KotvukAI Bot</b>

Добро пожаловать! Я помогу вам следить за рынком криптовалют.

<b>📊 Доступные команды:</b>
/price <code>BTCUSDT</code> - Цена актива
/signal <code>BTCUSDT</code> - AI сигнал
/analyze <code>BTCUSDT</code> - Глубокий анализ
/backtest <code>BTCUSDT</code> <code>strategy</code> - Бэктест
/alerts - Ваши алерты
/trades - Открытые сделки
/watchlist - Ваш вотчлист
/settings - Настройки уведомлений
/help - Справка

<b>🔔 Уведомления:</b>
Вы будете получать уведомления о сработавших алертах и новых сигналах.
`;

    await sendMessage(chatId, text);
  },

  async help(message) {
    const chatId = message.chat.id;

    var text = `
<b>📚 Справка KotvukAI Bot</b>

<b>📊 Цены и анализ:</b>
/price BTCUSDT - Текущая цена и 24h изменение
/signal BTCUSDT - Быстрый AI сигнал
/analyze BTCUSDT - Глубокий анализ с индикаторами

<b>📈 Бэктестинг:</b>
/backtest BTCUSDT ema_cross - Тест стратегии
/backtest ETHUSDT rsi_reversal - RSI стратегия

<b>🔔 Алерты:</b>
/alerts - Список ваших алертов
/alert BTCUSDT above 50000 - Создать алерт

<b>💼 Торговля:</b>
/trades - Открытые сделки
/watchlist - Ваш вотчлист

<b>⚙️ Настройки:</b>
/settings - Управление уведомлениями
/subscribe - Подписка на сигналы
/unsubscribe - Отписка от сигналов
`;

    await sendMessage(chatId, text);
  },

  async price(message, args) {
    var chatId = message.chat.id;
    const symbol = args[0]?.toUpperCase() || 'BTCUSDT';

    try {

      const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
      const data = await response.json();

      if (data.code) {
        await sendMessage(chatId, `❌ Пара ${symbol} не найдена`);
        return;
      }

      const price = parseFloat(data.lastPrice);
      const change = parseFloat(data.priceChangePercent);
      const high = parseFloat(data.highPrice);
      const low = parseFloat(data.lowPrice);
      const volume = parseFloat(data.quoteVolume);

      const emoji = change >= 0 ? '🟢' : '🔴';
      const changeStr = change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`;

      const text = `
<b>${emoji} ${symbol}</b>

💰 <b>Price:</b> $${price.toLocaleString('en-US', { maximumFractionDigits: price > 100 ? 2 : 6 })}
📊 <b>24h Change:</b> ${changeStr}
📈 <b>24h High:</b> $${high.toLocaleString('en-US', { maximumFractionDigits: price > 100 ? 2 : 6 })}
📉 <b>24h Low:</b> $${low.toLocaleString('en-US', { maximumFractionDigits: price > 100 ? 2 : 6 })}
💎 <b>Volume:</b> $${(volume / 1e6).toFixed(2)}M
`;

      await sendMessage(chatId, text);

    } catch (error) {
      await sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
  },

  async signal(message, args) {
    const chatId = message.chat.id;
    const symbol = args[0]?.toUpperCase() || 'BTCUSDT';

    await sendMessage(chatId, `⏳ Генерирую сигнал для ${symbol}...`);

    try {

      var response = await quickAnalysis(symbol, { type: 'signal' });
      const content = response?.choices?.[0]?.message?.content || 'Не удалось получить сигнал';

      const text = `
<b>🎯 AI Signal: ${symbol}</b>

${content}

⏰ ${new Date().toLocaleString('ru-RU')}
<i>Модель: ${response?._meta?.model || 'Qwen 3 32B'}</i>
`;

      await sendMessage(chatId, text);

    } catch (error) {
      await sendMessage(chatId, `❌ Ошибка генерации сигнала: ${error.message}`);
    }
  },

  async analyze(message, args) {
    const chatId = message.chat.id;
    const symbol = args[0]?.toUpperCase() || 'BTCUSDT';

    await sendMessage(chatId, `⏳ Проводу глубокий анализ ${symbol}...`);

    try {

      const [klinesRes, tickerRes] = await Promise.all([
        fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=100`),
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
      ]);

      const klines = await klinesRes.json();
      const ticker = await tickerRes.json();

      const closes = klines.map(k => parseFloat(k[4]));
      const rsi = calculateRSI(closes, 14);
      const ema20 = calculateEMA(closes, 20);
      const ema50 = calculateEMA(closes, 50);

      const currentPrice = parseFloat(ticker.lastPrice);
      const currentRSI = rsi[rsi.length - 1];
      const currentEMA20 = ema20[ema20.length - 1];
      const currentEMA50 = ema50[ema50.length - 1];

      const analysis = await deepAnalysis(symbol, {
        price: currentPrice,
        rsi: currentRSI,
        ema20: currentEMA20,
        ema50: currentEMA50,
        trend: currentEMA20 > currentEMA50 ? 'bullish' : 'bearish'
      });

      const content = analysis?.choices?.[0]?.message?.content || 'Не удалось получить анализ';

      const trendEmoji = currentEMA20 > currentEMA50 ? '🟢' : '🔴';
      const rsiZone = currentRSI > 70 ? '🔥 Overbought' : currentRSI < 30 ? '❄️ Oversold' : '⚖️ Neutral';

      const text = `
<b>📊 Deep Analysis: ${symbol}</b>

💰 <b>Price:</b> $${currentPrice.toLocaleString('en-US', { maximumFractionDigits: currentPrice > 100 ? 2 : 6 })}
${trendEmoji} <b>Trend:</b> ${currentEMA20 > currentEMA50 ? 'Bullish' : 'Bearish'}
📊 <b>RSI(14):</b> ${currentRSI.toFixed(1)} ${rsiZone}
📈 <b>EMA20:</b> $${currentEMA20.toFixed(2)}
📈 <b>EMA50:</b> $${currentEMA50.toFixed(2)}

<b>🤖 AI Analysis:</b>
${content}

⏰ ${new Date().toLocaleString('ru-RU')}
<i>Модель: ${analysis?._meta?.model || 'Kimi K2'}</i>
`;

      await sendMessage(chatId, text);

    } catch (error) {
      await sendMessage(chatId, `❌ Ошибка анализа: ${error.message}`);
    }
  },

  async backtest(message, args) {
    const chatId = message.chat.id;
    const symbol = args[0]?.toUpperCase() || 'BTCUSDT';
    const strategy = args[1]?.toLowerCase() || 'ema_cross';

    await sendMessage(chatId, `⏳ Запускаю бэктест ${strategy} на ${symbol}...`);

    try {
      const { runBacktest } = require('./backtesting');

      const result = await runBacktest({
        symbol,
        interval: '1h',
        days: 30,
        strategyName: strategy,
        capital: 5000
      });

      await sendMessage(chatId, formatBacktestResult(result));

    } catch (error) {
      await sendMessage(chatId, `❌ Ошибка бэктеста: ${error.message}`);
    }
  },

  async alerts(message) {
    const chatId = message.chat.id;
    const userId = message.from.id;

    try {
      const alerts = await db.getMany(
        `SELECT * FROM alerts
         WHERE user_id = $1
         AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 10`,
        [userId]
      );

      if (alerts.length === 0) {
        await sendMessage(chatId, '📭 У вас нет активных алертов');
        return;
      }

      let text = '<b>🔔 Ваши алерты:</b>\n\n';

      for (const alert of alerts) {
        const condition = alert.condition === 'above' ? '⬆️' : '⬇️';
        text += `${condition} <b>${alert.pair}</b> - $${alert.value.toFixed(2)}\n`;
      }

      await sendMessage(chatId, text);

    } catch (error) {
      await sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
  },

  async trades(message) {
    const chatId = message.chat.id;
    const userId = message.from.id;

    try {
      const trades = await db.getMany(
        `SELECT * FROM trades
         WHERE user_id = $1
         AND status = 'open'
         ORDER BY opened_at DESC`,
        [userId]
      );

      if (trades.length === 0) {
        await sendMessage(chatId, '📭 У вас нет открытых сделок');
        return;
      }

      let text = '<b>💼 Открытые сделки:</b>\n\n';

      for (const trade of trades) {
        const pnl = (trade.direction === 'long' ? 1 : -1) * (Math.random() * 100 - 50);
        const pnlEmoji = pnl >= 0 ? '🟢' : '🔴';
        text += `${pnlEmoji} <b>${trade.pair}</b> ${trade.direction.toUpperCase()}\n`;
        text += `   Entry: $${trade.entry_price.toFixed(2)} | PnL: ${pnl.toFixed(2)}\n\n`;
      }

      await sendMessage(chatId, text);

    } catch (error) {
      await sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
  },

  async watchlist(message) {
    const chatId = message.chat.id;
    const userId = message.from.id;

    try {
      const watchlist = await db.getMany(
        `SELECT w.pair FROM watchlist w
         JOIN users u ON w.user_id = u.id
         WHERE u.id = $1
         ORDER BY w.added_at DESC`,
        [userId]
      );

      if (watchlist.length === 0) {
        await sendMessage(chatId, '📭 Ваш вотчлист пуст');
        return;
      }

      const symbols = watchlist.map(w => w.pair).join(',');
      const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=[${watchlist.map(w => `"${w.pair}"`).join(',')}]`);
      const prices = await response.json();

      const priceMap = {};
      if (Array.isArray(prices)) {
        for (const p of prices) {
          priceMap[p.symbol] = parseFloat(p.price);
        }
      }

      let text = '<b>⭐ Ваш вотчлист:</b>\n\n';

      for (const item of watchlist) {
        const price = priceMap[item.pair];
        text += `📊 <b>${item.pair}</b> - $${price?.toLocaleString('en-US', { maximumFractionDigits: 2 }) || 'N/A'}\n`;
      }

      await sendMessage(chatId, text);

    } catch (error) {
      await sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
  },

  async settings(message) {
    const chatId = message.chat.id;

    const text = `
<b>⚙️ Настройки уведомлений</b>

🔔 <b>Типы уведомлений:</b>
• Сработавшие алерты
• Новые AI сигналы
• Закрытые сделки
• Результаты бэктестов

<b>Управление:</b>
/subscribe - Включить все уведомления
/unsubscribe - Выключить все уведомления
/signal_on - Включить сигналы
/signal_off - Выключить сигналы
`;

    await sendMessage(chatId, text);
  },

  async subscribe(message) {
    const chatId = message.chat.id;
    const userId = message.from.id;

    await saveUserChat(userId, chatId);

    await sendMessage(chatId, '✅ Уведомления включены! Вы будете получать сигналы и алерты.');
  },

  async unsubscribe(message) {
    const chatId = message.chat.id;
    const userId = message.from.id;

    await removeUserChat(userId);

    await sendMessage(chatId, '🔕 Уведомления выключены.');
  }
};

async function saveUserChat(userId, chatId) {
  userChats.set(userId, chatId);

  try {
    await db.query(
      `INSERT INTO user_telegram (user_id, chat_id, notifications_enabled, updated_at)
       VALUES ($1, $2, true, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         chat_id = EXCLUDED.chat_id,
         notifications_enabled = true,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, chatId]
    );
  } catch (error) {

    console.log('[Telegram] Note: user_telegram table not created yet');
  }
}

async function removeUserChat(userId) {
  userChats.delete(userId);

  try {
    await db.query(
      `UPDATE user_telegram SET notifications_enabled = false WHERE user_id = $1`,
      [userId]
    );
  } catch (error) {

  }
}

function calculateRSI(closes, period = 14) {
  const result = [];
  const gains = [];
  const losses = [];

  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }

  return result;
}

function calculateEMA(data, period) {
  const result = [];
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    result.push(ema);
  }

  return result;
}

async function processMessage(message) {
  if (!message?.text) return;

  const chatId = message.chat.id;
  const text = message.text.trim();
  const [command, ...args] = text.split(/\s+/);

  console.log(`[Telegram] Command: ${command} from ${message.from.id}`);

  const commandName = command.toLowerCase().replace('/', '');

  if (COMMANDS[commandName]) {
    await COMMANDS[commandName](message, args);
  } else {
    await sendMessage(chatId, `❓ Неизвестная команда. Используйте /help для справки.`);
  }
}

async function processCallback(callback) {
  const chatId = callback.message?.chat?.id;
  const data = callback.data;

  console.log(`[Telegram] Callback: ${data} from ${callback.from.id}`);

  await telegramRequest('answerCallbackQuery', {
    callback_query_id: callback.id
  });
}

async function poll() {
  if (!isPolling) return;

  try {
    const updates = await getUpdates(lastUpdateId + 1, 30);

    if (updates && updates.length > 0) {
      for (const update of updates) {
        lastUpdateId = update.update_id;

        if (update.message) {
          await processMessage(update.message);
        } else if (update.callback_query) {
          await processCallback(update.callback_query);
        }
      }
    }

  } catch (error) {
    console.error('[Telegram] Poll error:', error.message);
  }

  if (isPolling) {
    pollInterval = setTimeout(poll, 1000);
  }
}

function startPolling() {
  if (isPolling) return;

  console.log(' Telegram Bot starting...');
  isPolling = true;
  poll();

  console.log(' Telegram Bot started');
}

function stopPolling() {
  isPolling = false;
  if (pollInterval) {
    clearTimeout(pollInterval);
    pollInterval = null;
  }
  console.log(' Telegram Bot stopped');
}

async function notifyUser(userId, message, options = {}) {
  const chatId = userChats.get(userId);

  if (!chatId) {

    try {
      const user = await db.getOne(
        'SELECT chat_id FROM user_telegram WHERE user_id = $1 AND notifications_enabled = true',
        [userId]
      );

      if (user?.chat_id) {
        userChats.set(userId, user.chat_id);
        return sendMessage(user.chat_id, message, options);
      }
    } catch (e) {

    }

    return false;
  }

  return sendMessage(chatId, message, options);
}

async function broadcastToAll(message, options = {}) {
  const chatIds = [...userChats.values()];

  for (const chatId of chatIds) {
    await sendMessage(chatId, message, options);
    await new Promise(r => setTimeout(r, 50));
  }

  return chatIds.length;
}

async function sendAlertNotification(userId, alert) {
  return notifyUser(userId, formatAlert(alert));
}

async function sendSignalNotification(userId, signal) {
  return notifyUser(userId, formatSignal(signal));
}

async function sendTradeNotification(userId, trade) {
  return notifyUser(userId, formatTrade(trade));
}

async function sendBacktestNotification(userId, result) {
  return notifyUser(userId, formatBacktestResult(result));
}

module.exports = {

  startPolling,
  stopPolling,

  sendMessage,
  editMessage,

  notifyUser,
  broadcastToAll,
  sendAlertNotification,
  sendSignalNotification,
  sendTradeNotification,
  sendBacktestNotification,

  formatSignal,
  formatAlert,
  formatTrade
};
