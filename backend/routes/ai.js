const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { checkAiLimit, getAiUsageKey, dailyAiUsage } = require('../middleware/rateLimit');
const { calcIndicators } = require('../services/indicators');

const {
  deepAnalysis,
  quickAnalysis,
  chat,
  groqRequestWithFallback
} = require('../utils/groqKeys');
const { ALLOWED_SYMBOLS_SET: ALLOWED_SYMBOLS } = require('../utils/symbols');

router.get('/usage', (req, res) => {
  const plan = req.user?.plan || 'Free';
  const limits = { Free: 5, Pro: 50, Premium: -1 };
  const limit = limits[plan];
  const key = getAiUsageKey(req.userId);
  const used = dailyAiUsage[key] || 0;

  res.json({
    used,
    limit,
    remaining: limit === -1 ? 'unlimited' : Math.max(0, limit - used),
    plan
  });
});

router.post('/analyze', async (req, res) => {
  if (!checkAiLimit(req, res)) return;

  try {
    const { symbol, price, change24h, high, low, volume, fng, marketData } = req.body;

    if (!ALLOWED_SYMBOLS.has(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol. Use one of the supported pairs.' });
    }

    const timeframes = ['5m', '15m', '1h', '4h', '1d', '1w'];
    const indicators = {};

    for (const tf of timeframes) {
      try {
        const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol || 'BTCUSDT'}&interval=${tf}&limit=200`);
        const klines = await r.json();
        if (Array.isArray(klines)) {
          indicators[tf] = calcIndicators(klines);
        }
      } catch (e) {
        console.error(`Klines ${tf} error:`, e.message);
      }
    }

    let btcContext = '';
    if (symbol && symbol !== 'BTCUSDT') {
      try {
        const r = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
        const btcData = await r.json();
        const btcChange = (+btcData.priceChangePercent).toFixed(2);
        const btcTrend = +btcChange > 0 ? 'bullish' : 'bearish';
        btcContext = `\n\n📊 BTC Correlation: BTC 24h trend: ${btcChange > 0 ? '+' : ''}${btcChange}% (${btcTrend})`;
      } catch (e) { /* не страшно */ }
    }

    const pastSignals = await db.getMany('SELECT * FROM signal_results ORDER BY created_at DESC LIMIT 10');
    let learningContext = '';
    if (pastSignals.length > 0) {
      learningContext = '\n\n🧠 SELF-LEARNING — Last 10 signals:\n';
      for (const sig of pastSignals) {
        learningContext += `- ${sig.pair} ${sig.direction || '?'} @ $${sig.entry_price} → ${sig.result === 'tp_hit' ? '✅ TP' : sig.result === 'sl_hit' ? '❌ SL' : '⏳'}`;
        if (sig.ai_reflection) learningContext += ` | ${sig.ai_reflection.slice(0, 100)}`;
        learningContext += '\n';
      }
    }

    let indicatorText = '';
    for (const tf of timeframes) {
      if (indicators[tf]) {
        const ind = indicators[tf];
        indicatorText += `\n[${tf.toUpperCase()}] RSI: ${ind.rsi14 ?? 'N/A'} | EMA: ${ind.ema9?.toFixed(2) || 'N/A'}/${ind.ema21?.toFixed(2) ?? 'N/A'}/${ind.ema50?.toFixed(2) || 'N/A'}`;
      }
    }

    const tfSignals = {};
    for (const tf of timeframes) {
      if (indicators[tf]) {
        const ind = indicators[tf];
        const isBullish = (ind.rsi14 && ind.rsi14 > 50) && (ind.ema9 && ind.ema21 && ind.ema9 > ind.ema21);
        tfSignals[tf] = isBullish ? 'bullish' : 'bearish';
      }
    }

    const values = Object.values(tfSignals);
    const allSame = values.length > 1 && new Set(values).size === 1;
    const tfAgreement = values.length > 1
      ? allSame ? `\n\n⚡ All timeframes AGREE: ${values[0].toUpperCase()}`
        : `\n\n⚠️ Timeframes DISAGREE`
      : '';

    const prompt = `Проанализируй криптовалюту ${symbol || 'BTCUSDT'} по 6 таймфреймам.

Текущие данные:
- Цена: $${price}
- Изменение за 24ч: ${change24h}%
- Fear & Greed Index: ${fng || 'N/A'}

📐 Технические индикаторы:${indicatorText}${tfAgreement}${btcContext}${learningContext}

Дай структурированный анализ:

## 📊 Общий Анализ
- **Общий тренд**: (Bullish/Bearish/Neutral)
- **Уверенность**: X% (0-100)
- **Оценка монеты**: X/10 (1-10)

## 🎯 Торговый Сигнал
- **Направление**: LONG/SHORT/НЕЙТРАЛЬНО
- **Точка входа**: $X
- **Take Profit**: $X
- **Stop Loss**: $X
- **Risk/Reward**: 1:X

## 🔍 Анализ Рисков
- Основные риски
- Рекомендуемый размер позиции`;

    const customData = await groqRequestWithFallback('kimi', [
      { role: 'system', content: 'Ты крипто-аналитик. Отвечай по-русски, используй markdown для структуры.' },
      { role: 'user', content: prompt }
    ], { maxTokens: 4000, temperature: 0.6 });

    const text = customData?.choices?.[0]?.message?.content || 'Ошибка получения ответа';

    let confidence = null;
    let coinScore = null;
    const confMatch = text.match(/[Уу]веренность[:\s]*(\d{1,3})\s*%/i) || text.match(/(\d{1,3})\s*%/);
    if (confMatch) confidence = Math.min(100, Math.max(0, +confMatch[1]));

    const scoreMatch = text.match(/[Оо]ценка\s*монеты[:\s]*(\d{1,2})\s*\/\s*10/i) || text.match(/(\d{1,2})\s*\/\s*10/);
    if (scoreMatch) coinScore = Math.min(10, Math.max(1, +scoreMatch[1]));

    let direction = null;
    const upper = text.toUpperCase();
    if (upper.includes('LONG') && !upper.includes('SHORT')) direction = 'LONG';
    else if (upper.includes('SHORT') && !upper.includes('LONG')) direction = 'SHORT';

    let tpPrice = null;
    let slPrice = null;
    const tpMatch = text.match(/(?:TP|Take\s*Profit)[:\s]*\$?([\d,.]+)/i);
    const slMatch = text.match(/(?:SL|Stop\s*Loss)[:\s]*\$?([\d,.]+)/i);
    if (tpMatch) tpPrice = +tpMatch[1].replace(',', '');
    if (slMatch) slPrice = +slMatch[1].replace(',', '');

    if (direction && price) {
      try {
        await db.query(
          `INSERT INTO signal_results (pair, direction, entry_price, tp_price, sl_price, ai_analysis, confidence, coin_score)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [symbol || 'BTCUSDT', direction, +price, tpPrice, slPrice, text.slice(0, 500), confidence, coinScore]
        );
        console.log(` Signal saved: ${symbol} ${direction} @ $${price}`);
      } catch (e) { console.error('Save signal error:', e.message); }
    }

    res.json({
      analysis: text,
      confidence,
      coinScore,
      direction,
      entryPrice: +price,
      tpPrice,
      slPrice,
      model: customData._meta
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/quick', async (req, res) => {
  if (!checkAiLimit(req, res)) return;

  try {
    const { symbol, indicators } = req.body;

    if (!ALLOWED_SYMBOLS.has(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol' });
    }

    const data = await quickAnalysis(symbol, indicators);
    const text = data?.choices?.[0]?.message?.content || 'Ошибка';

    res.json({ analysis: text, model: data._meta });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/chat', async (req, res) => {
  if (!checkAiLimit(req, res)) return;

  try {
    const { message, history = [] } = req.body;

    const data = await chat(message, history);

    res.json({
      reply: data?.choices?.[0]?.message?.content || 'Ошибка',
      model: data._meta
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
