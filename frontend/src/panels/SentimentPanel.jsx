import { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';

export default function SentimentPanel() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [symbol, setSymbol] = useState('BTC');
  const [marketSentiment, setMarketSentiment] = useState(null);
  const [fearGreed, setFearGreed] = useState(null);
  const [newsSentiment, setNewsSentiment] = useState(null);
  const [signals, setSignals] = useState(null);

  useEffect(() => {
    loadSentimentData();
  }, [symbol]);

  const loadSentimentData = async () => {
    setLoading(true);
    try {
      const [marketRes, fgRes, signalsRes] = await Promise.all([
        fetch(`/api/sentiment/market/${symbol}`).catch(() => null),
        fetch('/api/sentiment/fear-greed?days=7').catch(() => null),
        fetch(`/api/sentiment/signals/${symbol}`).catch(() => null)
      ]);

      if (marketRes) {
        const data = await marketRes.json();
        setMarketSentiment(data);
        setNewsSentiment(data.news_sentiment);
      }
      if (fgRes) {
        const data = await fgRes.json();
        setFearGreed(data);
      }
      if (signalsRes) {
        const data = await signalsRes.json();
        setSignals(data);
      }
    } catch (e) {
      console.error('Failed to load sentiment:', e);
    } finally {
      setLoading(false);
    }
  };

  const analyzeCustomText = async (text) => {
    try {
      const res = await fetch('/api/sentiment/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      return data;
    } catch (e) {
      return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">🧠 AI Sentiment Analysis</h2>
        <div className="flex items-center gap-2">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="px-4 py-2 bg-gray-800 rounded-lg border border-gray-700"
          >
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
            <option value="SOL">SOL</option>
            <option value="XRP">XRP</option>
            <option value="DOGE">DOGE</option>
          </select>
          <button
            onClick={loadSentimentData}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {}
      {marketSentiment?.composite && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {}
          <div className="bg-gray-800 rounded-xl p-6 text-center">
            <h3 className="text-lg font-semibold mb-4">Overall Sentiment</h3>
            <SentimentGauge
              score={marketSentiment.composite.score}
              label={marketSentiment.composite.label}
            />
            <div className="mt-4 text-sm text-gray-400">
              Confidence: {(marketSentiment.composite.confidence * 100).toFixed(0)}%
            </div>
          </div>

          {}
          <div className="bg-gray-800 rounded-xl p-6 text-center">
            <h3 className="text-lg font-semibold mb-4">Fear & Greed Index</h3>
            <FearGreedGauge
              value={marketSentiment.composite.fear_greed_index}
              classification={marketSentiment.composite.classification}
            />
          </div>

          {}
          <div className="bg-gray-800 rounded-xl p-6 text-center">
            <h3 className="text-lg font-semibold mb-4">AI Signal</h3>
            {signals?.signals?.[0] && (
              <div className={`text-4xl font-bold mb-2 ${
                signals.signals[0].type === 'BUY' ? 'text-green-400' :
                signals.signals[0].type === 'SELL' ? 'text-red-400' :
                signals.signals[0].type === 'CONTRARIAN_BUY' ? 'text-blue-400' :
                signals.signals[0].type === 'CONTRARIAN_SELL' ? 'text-orange-400' :
                'text-gray-400'
              }`}>
                {signals.signals[0].type}
              </div>
            )}
            {signals?.signals?.[0]?.reason && (
              <p className="text-sm text-gray-400">{signals.signals[0].reason}</p>
            )}
          </div>
        </div>
      )}

      {}
      {fearGreed?.history && (
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">📈 Fear & Greed Trend (7 Days)</h3>
          <div className="flex items-end gap-1 h-32">
            {fearGreed.history.slice().reverse().map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full rounded-t transition-all duration-300"
                  style={{
                    height: `${day.value}%`,
                    backgroundColor: getFearGreedColor(day.value)
                  }}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(day.timestamp).toLocaleDateString('en', { weekday: 'short' })}
                </div>
              </div>
            ))}
          </div>
          {fearGreed.trend && (
            <div className="mt-4 text-sm text-gray-400">
              <span>Trend: </span>
              <span className={`font-semibold ${
                fearGreed.trend.direction === 'increasing_greed' ? 'text-green-400' :
                fearGreed.trend.direction === 'increasing_fear' ? 'text-red-400' :
                'text-gray-400'
              }`}>
                {fearGreed.trend.direction.replace('_', ' ').toUpperCase()}
              </span>
              <span className="ml-4">Change: {fearGreed.trend.change > 0 ? '+' : ''}{fearGreed.trend.change} points</span>
            </div>
          )}
        </div>
      )}

      {}
      {signals?.signals && signals.signals.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">🎯 Trading Signals</h3>
          <div className="space-y-3">
            {signals.signals.map((signal, i) => (
              <div
                key={i}
                className={`p-4 rounded-lg border ${
                  signal.type.includes('BUY') ? 'border-green-500/30 bg-green-500/10' :
                  signal.type.includes('SELL') ? 'border-red-500/30 bg-red-500/10' :
                  'border-gray-500/30 bg-gray-500/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`font-bold ${
                      signal.type.includes('BUY') ? 'text-green-400' :
                      signal.type.includes('SELL') ? 'text-red-400' :
                      'text-gray-400'
                    }`}>
                      {signal.type}
                    </span>
                    <span className="ml-2 text-xs px-2 py-1 rounded bg-gray-700">
                      {signal.strength}
                    </span>
                  </div>
                  <span className="text-sm text-gray-400">
                    Confidence: {(signal.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-2">{signal.reason}</p>
                {signal.historical_context && (
                  <p className="text-xs text-gray-500 mt-1 italic">
                    💡 {signal.historical_context}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {}
      {marketSentiment?.social_sentiment?.social_metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SocialCard
            platform="Twitter/X"
            data={marketSentiment.social_sentiment.social_metrics.twitter}
            icon="🐦"
          />
          <SocialCard
            platform="Reddit"
            data={marketSentiment.social_sentiment.social_metrics.reddit}
            icon="🔴"
          />
          <SocialCard
            platform="Telegram"
            data={marketSentiment.social_sentiment.social_metrics.telegram}
            icon="✈️"
          />
        </div>
      )}

      {}
      {newsSentiment?.items && newsSentiment.items.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">📰 Latest News Sentiment</h3>
          <div className="space-y-3">
            {newsSentiment.items.slice(0, 5).map((item, i) => (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <span>{item.source}</span>
                      <span>•</span>
                      <span>{new Date(item.published_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    item.sentiment === 'bullish' ? 'bg-green-500/20 text-green-400' :
                    item.sentiment === 'bearish' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {item.sentiment}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {}
      {marketSentiment?.social_sentiment?.trending_keywords && (
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">🔥 Trending Keywords</h3>
          <div className="flex flex-wrap gap-2">
            {marketSentiment.social_sentiment.trending_keywords.map((kw, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-gray-700 rounded-full text-sm hover:bg-gray-600 transition cursor-pointer"
              >
                #{kw.keyword}
                <span className={`ml-2 text-xs ${
                  parseFloat(kw.volume_change) > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {kw.volume_change}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SentimentGauge({ score, label }) {
  const rotation = ((score + 100) / 200) * 180 - 90;

  return (
    <div className="relative w-48 h-24 mx-auto overflow-hidden">
      {}
      <div className="absolute inset-0 rounded-t-full"
        style={{
          background: 'conic-gradient(from 180deg, #ef4444, #f97316, #eab308, #22c55e, #22c55e)',
        }}
      />
      {}
      <div
        className="absolute bottom-0 left-1/2 w-1 h-20 bg-white origin-bottom transition-transform duration-500"
        style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
      />
      {}
      <div className="absolute bottom-0 left-1/2 w-4 h-4 bg-white rounded-full transform -translate-x-1/2 translate-y-1/2" />
      {}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-8">
        <span className={`text-2xl font-bold ${
          label === 'bullish' ? 'text-green-400' :
          label === 'bearish' ? 'text-red-400' :
          'text-gray-400'
        }`}>
          {score}
        </span>
      </div>
    </div>
  );
}

function FearGreedGauge({ value, classification }) {
  return (
    <div className="relative">
      <div className="text-5xl font-bold" style={{ color: getFearGreedColor(value) }}>
        {value}
      </div>
      <div className="text-sm text-gray-400 mt-1">{classification}</div>
    </div>
  );
}

function SocialCard({ platform, data, icon }) {
  if (!data) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <h4 className="font-semibold">{platform}</h4>
      </div>
      <div className="space-y-2 text-sm">
        {data.mentions_24h && (
          <div className="flex justify-between text-gray-400">
            <span>Mentions (24h)</span>
            <span className="text-white">{data.mentions_24h.toLocaleString()}</span>
          </div>
        )}
        {data.posts_24h && (
          <div className="flex justify-between text-gray-400">
            <span>Posts (24h)</span>
            <span className="text-white">{data.posts_24h.toLocaleString()}</span>
          </div>
        )}
        {data.sentiment_score !== undefined && (
          <div className="flex justify-between text-gray-400">
            <span>Sentiment</span>
            <span className={data.sentiment_score > 0 ? 'text-green-400' : 'text-red-400'}>
              {data.sentiment_score.toFixed(0)}
            </span>
          </div>
        )}
        {data.engagement_rate && (
          <div className="flex justify-between text-gray-400">
            <span>Engagement</span>
            <span className="text-white">{data.engagement_rate}%</span>
          </div>
        )}
        {data.trending_score && (
          <div className="flex justify-between text-gray-400">
            <span>Trending</span>
            <span className="text-white">{data.trending_score}/10</span>
          </div>
        )}
      </div>
    </div>
  );
}

function getFearGreedColor(value) {
  if (value >= 80) return '#22c55e';
  if (value >= 60) return '#84cc16';
  if (value >= 40) return '#eab308';
  if (value >= 20) return '#f97316';
  return '#ef4444';
}
