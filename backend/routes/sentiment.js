const express = require('express');
const router = express.Router();
const sentiment = require('../services/sentiment');

// alternative.me иногда лагает — отвечает с задержкой 2-3 сек, но данные свежие
router.get('/fear-greed', async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const response = await fetch(`https://api.alternative.me/fng/?limit=${Math.min(days, 30)}`);
    const data = await response.json();

    if (data.data) {
      const result = {
        current: {
          value: parseInt(data.data[0].value),
          classification: data.data[0].value_classification,
          timestamp: new Date(data.data[0].timestamp * 1000).toISOString()
        },
        history: data.data.map(d => ({
          value: parseInt(d.value),
          classification: d.value_classification,
          timestamp: new Date(d.timestamp * 1000).toISOString()
        })),
        trend: analyzeFearGreedTrend(data.data)
      };

      res.json(result);
    } else {
      res.status(502).json({ error: 'Failed to fetch Fear & Greed data' });
    }

  } catch (err) {
    console.error('Fear & Greed error:', err);
    res.status(500).send('server error');
  }
});

router.get('/market/:symbol?', async (req, res) => {
  try {
    const symbol = req.params.symbol || 'BTC';

    const result = await sentiment.getMarketSentiment(symbol.toUpperCase());
    res.json(result);

  } catch (err) {
    console.error('Market sentiment error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/analyze', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = sentiment.analyzeTextSentiment(text);
    res.json(result);

  } catch (err) {
    console.error('Text analysis error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/news', async (req, res) => {
  try {
    const { symbols } = req.query;
    const symbolList = symbols ? symbols.split(',') : ['BTC', 'ETH', 'crypto'];

    const result = await sentiment.getNewsSentiment(symbolList);
    res.json(result);

  } catch (e) {
    console.error('News sentiment error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/social/:symbol?', async (req, res) => {
  try {
    const symbol = req.params.symbol || 'BTC';

    const result = await sentiment.getSocialSentiment(symbol.toUpperCase());
    res.json(result);

  } catch (err) {
    console.error('Social sentiment error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/history/:symbol?', async (req, res) => {
  try {
    const symbol = req.params.symbol || 'BTC';
    const { days = 7 } = req.query;

    const result = await sentiment.getHistoricalSentiment(symbol.toUpperCase(), parseInt(days));
    res.json(result);

  } catch (err) {
    console.error('Historical sentiment error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/signals/:symbol?', async (req, res) => {
  try {
    const symbol = req.params.symbol || 'BTC';

    const marketSentiment = await sentiment.getMarketSentiment(symbol.toUpperCase());

    const signals = [];
    const { composite, news_sentiment, social_sentiment } = marketSentiment;

    if (composite.score > 30) {
      signals.push({
        type: 'BUY',
        strength: composite.score > 50 ? 'STRONG' : 'MODERATE',
        reason: `Strong bullish sentiment (${composite.score})`,
        confidence: composite.confidence,
        fear_greed: composite.classification
      });
    } else if (composite.score < -30) {
      signals.push({
        type: 'SELL',
        strength: composite.score < -50 ? 'STRONG' : 'MODERATE',
        reason: `Strong bearish sentiment (${composite.score})`,
        confidence: composite.confidence,
        fear_greed: composite.classification
      });
    } else {
      signals.push({
        type: 'HOLD',
        strength: 'NEUTRAL',
        reason: `Neutral sentiment (${composite.score})`,
        confidence: composite.confidence,
        fear_greed: composite.classification
      });
    }

    if (composite.fear_greed_index <= 20) {
      signals.push({
        type: 'CONTRARIAN_BUY',
        strength: 'HIGH',
        reason: 'Extreme Fear - Historically good entry point',
        confidence: 0.75,
        historical_context: 'Extreme fear often precedes price rebounds'
      });
    } else if (composite.fear_greed_index >= 80) {
      signals.push({
        type: 'CONTRARIAN_SELL',
        strength: 'HIGH',
        reason: 'Extreme Greed - Market may be overextended',
        confidence: 0.75,
        historical_context: 'Extreme greed often precedes corrections'
      });
    }

    const newsScore = news_sentiment.aggregate?.score || 0;
    const socialScore = social_sentiment.aggregate_sentiment?.score || 0;

    if (Math.abs(newsScore - socialScore) > 30) {
      signals.push({
        type: 'DIVERGENCE',
        strength: 'MODERATE',
        reason: `News sentiment (${newsScore}) diverges from social sentiment (${socialScore})`,
        confidence: 0.6,
        action: 'Monitor for potential trend change'
      });
    }

    res.json({
      symbol: symbol.toUpperCase(),
      signals,
      sentiment_summary: composite,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Sentiment signals error:', err);
    res.status(500).json({ error: err.message });
  }
});

function analyzeFearGreedTrend(data) {
  if (!data || data.length < 2) return 'stable';

  const recent = parseInt(data[0].value);
  const previous = parseInt(data[data.length - 1].value);
  const change = recent - previous;

  let direction;
  if (change > 10) direction = 'increasing_greed';
  else if (change < -10) direction = 'increasing_fear';
  else direction = 'stable';

  const avg = data.reduce((s, d) => s + parseInt(d.value), 0) / data.length;

  // volatility через дисперсию — показывает насколько FnG "прыгает" за период
  return {
    direction,
    change: change,
    average: Math.round(avg),
    volatility: Math.round(Math.sqrt(
      data.reduce((s, d) => s + Math.pow(parseInt(d.value) - avg, 2), 0) / data.length
    ))
  };
}

module.exports = router;
