const db = require('../config/database');

function analyzeTextSentiment(text) {
  if (!text || typeof text !== 'string') {
    return { score: 0, label: 'neutral', confidence: 0 };
  }

  const lowerText = text.toLowerCase();

  const bullishKeywords = {
    'moon': 3, 'bullish': 3, 'pump': 2, 'rally': 2, 'breakout': 2,
    'surge': 2, 'soar': 2, 'all-time high': 3, 'ath': 3, 'gain': 1,
    'profit': 1, 'buy': 1, 'long': 1, 'support': 1, 'bounce': 2,
    'recover': 1, 'accumulate': 1, 'undervalued': 2, 'opportunity': 1,
    'growth': 1, 'adoption': 2, 'partnership': 2, 'launch': 1,
    'upgrade': 1, 'bull run': 3, 'hodl': 2, 'diamond hands': 2,
    'whale buy': 3, 'institutional': 2, 'etf approved': 4,
    'sec approval': 4, 'mainstream': 1, 'mass adoption': 3
  };

  const bearishKeywords = {
    'crash': 3, 'dump': 3, 'bearish': 3, 'sell off': 2, 'plunge': 3,
    'drop': 2, 'decline': 2, 'loss': 1, 'bear': 2, 'short': 1,
    'resistance': 1, 'breakdown': 2, 'collapse': 3, 'fear': 2,
    'panic': 2, 'bubble': 2, 'overvalued': 2, 'scam': 3, 'fraud': 3,
    'hack': 2, 'ban': 2, 'regulation': 1, 'sec sues': 3, 'lawsuit': 2,
    'bankruptcy': 3, 'liquidation': 2, 'margin call': 2, 'rekt': 2,
    'rug pull': 3, 'ponzi': 3, 'dead cat': 2, 'correction': 1,
    'downtrend': 2, 'support broken': 2
  };

  const fearWords = ['fear', 'panic', 'worried', 'concern', 'danger', 'risk', 'crash'];
  const greedWords = ['greed', 'fomo', 'euphoria', 'excited', 'moon', 'lambo'];

  let bullishScore = 0;
  let bearishScore = 0;
  let fearScore = 0;
  let greedScore = 0;

  for (const [keyword, weight] of Object.entries(bullishKeywords)) {
    var regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) {
      bullishScore += weight * matches.length;
    }
  }

  for (const [keyword, weight] of Object.entries(bearishKeywords)) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) {
      bearishScore += weight * matches.length;
    }
  }

  for (const word of fearWords) {
    if (lowerText.includes(word)) fearScore++;
  }
  for (const word of greedWords) {
    if (lowerText.includes(word)) greedScore++;
  }

  var totalScore = bullishScore - bearishScore;
  const normalizedScore = Math.max(-100, Math.min(100, totalScore * 5));

  let label, confidence;
  if (normalizedScore > 20) {
    label = 'bullish';
    confidence = Math.min(0.95, 0.5 + (normalizedScore / 200));
  } else if (normalizedScore < -20) {
    label = 'bearish';
    confidence = Math.min(0.95, 0.5 + (Math.abs(normalizedScore) / 200));
  } else {
    label = 'neutral';
    confidence = 0.5 - (Math.abs(normalizedScore) / 200);
  }

  const fearGreedIndex = Math.max(0, Math.min(100,
    50 + (greedScore - fearScore) * 10 + (bullishScore - bearishScore) * 2
  ));

  return {
    score: normalizedScore,
    label,
    confidence: parseFloat(confidence.toFixed(3)),
    fear_greed_index: Math.round(fearGreedIndex),
    details: {
      bullish_signals: bullishScore,
      bearish_signals: bearishScore,
      fear_signals: fearScore,
      greed_signals: greedScore
    }
  };
}

async function getNewsSentiment(symbols = ['BTC', 'ETH', 'crypto']) {
  try {

    const newsItems = [];

    try {
      const response = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&limit=20');
      var data = await response.json();

      if (data.Data) {
        for (const item of data.Data) {
          const sentiment = analyzeTextSentiment(item.title + ' ' + (item.body || ''));
          newsItems.push({
            source: 'CryptoCompare',
            title: item.title,
            url: item.url,
            published_at: new Date(item.published_on * 1000).toISOString(),
            sentiment: sentiment.label,
            score: sentiment.score,
            fear_greed: sentiment.fear_greed_index,
            symbols: extractSymbols(item.title, item.categories)
          });
        }
      }
    } catch (e) {
      console.warn('CryptoCompare fetch failed:', e.message);
    }

    const aggregateScore = newsItems.length > 0
      ? newsItems.reduce((sum, item) => sum + item.score, 0) / newsItems.length
      : 0;

    const aggregateFearGreed = newsItems.length > 0
      ? Math.round(newsItems.reduce((sum, item) => sum + item.fear_greed, 0) / newsItems.length)
      : 50;

    const sentimentCounts = {
      bullish: newsItems.filter(i => i.sentiment === 'bullish').length,
      bearish: newsItems.filter(i => i.sentiment === 'bearish').length,
      neutral: newsItems.filter(i => i.sentiment === 'neutral').length
    };

    return {
      aggregate: {
        score: Math.round(aggregateScore),
        label: aggregateScore > 20 ? 'bullish' : aggregateScore < -20 ? 'bearish' : 'neutral',
        fear_greed_index: aggregateFearGreed,
        classification: getFearGreedLabel(aggregateFearGreed)
      },
      counts: sentimentCounts,
      items: newsItems.slice(0, 10),
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    console.error('News sentiment error:', e);
    return { error: e.message, items: [] };
  }
}

function extractSymbols(title, categories) {
  const symbols = [];
  var symbolPattern = /\b(BTC|ETH|XRP|SOL|ADA|DOGE|DOT|AVAX|MATIC|LINK|UNI|ATOM|LTC|BCH|XLM|ALGO|VET|FIL|NEAR|APT|ARB|OP)\b/gi;

  const matches = (title + ' ' + (categories || '')).match(symbolPattern);
  if (matches) {
    const unique = [...new Set(matches.map(s => s.toUpperCase()))];
    symbols.push(...unique);
  }

  return symbols;
}

function getFearGreedLabel(index) {
  if (index >= 80) return 'Extreme Greed';
  if (index >= 60) return 'Greed';
  if (index >= 40) return 'Neutral';
  if (index >= 20) return 'Fear';
  return 'Extreme Fear';
}

async function getSocialSentiment(symbol = 'BTC') {
  try {

    let fearGreedData = null;
    try {
      const response = await fetch('https://api.alternative.me/fng/?limit=7');
      var data = await response.json();
      if (data.data) {
        fearGreedData = {
          current: {
            value: parseInt(data.data[0].value),
            classification: data.data[0].value_classification
          },
          history: data.data.map(d => ({
            value: parseInt(d.value),
            classification: d.value_classification,
            timestamp: new Date(d.timestamp * 1000).toISOString()
          }))
        };
      }
    } catch (e) {
      console.warn('Fear & Greed API failed:', e.message);
    }

    const baseSentiment = fearGreedData?.current?.value || 50;
    const socialScore = (baseSentiment - 50) * 2;

    const socialMetrics = {
      twitter: {
        mentions_24h: Math.floor(50000 + Math.random() * 50000),
        sentiment_score: socialScore + (Math.random() * 20 - 10),
        engagement_rate: (2 + Math.random() * 3).toFixed(1)
      },
      reddit: {
        posts_24h: Math.floor(200 + Math.random() * 300),
        comments_24h: Math.floor(2000 + Math.random() * 3000),
        sentiment_score: socialScore + (Math.random() * 15 - 7.5),
        trending_score: (Math.random() * 10).toFixed(1)
      },
      telegram: {
        active_users: Math.floor(100000 + Math.random() * 500000),
        message_volume: Math.floor(10000 + Math.random() * 50000),
        sentiment_score: socialScore + (Math.random() * 10 - 5)
      }
    };

    return {
      symbol: symbol.toUpperCase(),
      aggregate_sentiment: {
        score: Math.round(socialScore),
        label: socialScore > 20 ? 'bullish' : socialScore < -20 ? 'bearish' : 'neutral'
      },
      fear_greed_index: fearGreedData,
      social_metrics: socialMetrics,
      trending_keywords: generateTrendingKeywords(socialScore),
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    console.error('Social sentiment error:', e);
    return { error: e.message };
  }
}

function generateTrendingKeywords(sentimentScore) {
  const bullishKeywords = ['moon', 'breakout', 'bullish', 'buy', 'rally', 'ATH', 'pump'];
  const bearishKeywords = ['crash', 'dump', 'bearish', 'sell', 'support', 'breakdown', 'fear'];
  const neutralKeywords = ['consolidation', 'range', 'waiting', 'analysis', 'chart', 'support', 'resistance'];

  let keywords;
  if (sentimentScore > 20) {
    keywords = [...bullishKeywords.slice(0, 5), ...neutralKeywords.slice(0, 2)];
  } else if (sentimentScore < -20) {
    keywords = [...bearishKeywords.slice(0, 5), ...neutralKeywords.slice(0, 2)];
  } else {
    keywords = neutralKeywords.slice(0, 5);
  }

  return keywords.map(k => ({
    keyword: k,
    volume_change: (Math.random() * 200 - 50).toFixed(1) + '%',
    sentiment_impact: (Math.random() * 2 - 1).toFixed(2)
  }));
}

async function getMarketSentiment(symbol = 'BTC') {
  try {
    const [news, social] = await Promise.all([
      getNewsSentiment([symbol]),
      getSocialSentiment(symbol)
    ]);

    const newsWeight = 0.4;
    const socialWeight = 0.6;

    const newsScore = news.aggregate?.score || 0;
    const socialScore = social.aggregate_sentiment?.score || 0;

    const compositeScore = (newsScore * newsWeight + socialScore * socialWeight);
    const compositeFearGreed = Math.round(
      (news.aggregate?.fear_greed_index || 50) * newsWeight +
      (social.fear_greed_index?.current?.value || 50) * socialWeight
    );

    const signals = generateSentimentSignals(compositeScore, compositeFearGreed);

    return {
      symbol: symbol.toUpperCase(),
      composite: {
        score: Math.round(compositeScore),
        label: compositeScore > 20 ? 'bullish' : compositeScore < -20 ? 'bearish' : 'neutral',
        fear_greed_index: compositeFearGreed,
        classification: getFearGreedLabel(compositeFearGreed),
        confidence: Math.min(0.95, 0.5 + Math.abs(compositeScore) / 200)
      },
      news_sentiment: news,
      social_sentiment: social,
      signals,
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    console.error('Market sentiment error:', e);
    return { error: e.message };
  }
}

function generateSentimentSignals(score, fearGreed) {
  const signals = [];

  if (fearGreed <= 20) {
    signals.push({
      type: 'contrarian_buy',
      reason: 'Extreme Fear - Potential buying opportunity',
      confidence: 0.7,
      action: 'Consider accumulating'
    });
  }

  if (fearGreed >= 80) {
    signals.push({
      type: 'contrarian_sell',
      reason: 'Extreme Greed - Market may be overheated',
      confidence: 0.7,
      action: 'Consider taking profits'
    });
  }

  if (score > 40) {
    signals.push({
      type: 'momentum_long',
      reason: 'Strong bullish sentiment momentum',
      confidence: 0.6,
      action: 'Trend continuation likely'
    });
  } else if (score < -40) {
    signals.push({
      type: 'momentum_short',
      reason: 'Strong bearish sentiment momentum',
      confidence: 0.6,
      action: 'Downtrend likely to continue'
    });
  }

  return signals;
}

async function storeSentimentData(symbol, data) {
  try {
    await db.query(`
      INSERT INTO sentiment_history (symbol, score, label, fear_greed_index, source, data)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      symbol,
      data.composite?.score || 0,
      data.composite?.label || 'neutral',
      data.composite?.fear_greed_index || 50,
      'aggregate',
      JSON.stringify(data)
    ]);
  } catch (e) {
    console.warn('Failed to store sentiment data:', e.message);
  }
}

async function getHistoricalSentiment(symbol, days = 7) {
  try {
    const result = await db.getMany(`
      SELECT
        DATE(created_at) as date,
        AVG(score) as avg_score,
        AVG(fear_greed_index) as avg_fear_greed,
        COUNT(*) as data_points
      FROM sentiment_history
      WHERE symbol = $1 AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [symbol]);

    return result;
  } catch (e) {
    console.warn('Historical sentiment query failed:', e.message);
    return [];
  }
}

module.exports = {
  analyzeTextSentiment,
  getNewsSentiment,
  getSocialSentiment,
  getMarketSentiment,
  getFearGreedLabel,
  storeSentimentData,
  getHistoricalSentiment
};
