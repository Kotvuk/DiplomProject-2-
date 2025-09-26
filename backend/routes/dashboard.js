const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { quickAnalysis } = require('../utils/groqKeys');

router.get('/', async (req, res) => {
  try {
    var closed = await db.getMany("SELECT * FROM trades WHERE status = 'closed'");
    const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);

    const allSignals = await db.getMany("SELECT * FROM signal_results WHERE result != 'pending'");
    const tpHit = allSignals.filter(s => s.result === 'tp_hit').length;
    const signalAccuracy = allSignals.length > 0 ? (tpHit / allSignals.length * 100) : 0;

    const today = new Date().toISOString().slice(0, 10);
    const todaySignals = await db.getMany(
      "SELECT * FROM signal_results WHERE DATE(created_at) = $1 AND result = 'tp_hit' ORDER BY accuracy_score DESC LIMIT 1",
      [today]
    );
    var bestSignal = todaySignals[0] || null;

    let topMover = null;
    try {
      const r = await fetch('https://api.binance.com/api/v3/ticker/24hr');
      const data = await r.json();
      const pairs = ['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT','SOLUSDT','DOGEUSDT','DOTUSDT','AVAXUSDT'];
      const filtered = data.filter(t => pairs.includes(t.symbol));
      if (filtered.length) {
        filtered.sort((a, b) => Math.abs(+b.priceChangePercent) - Math.abs(+a.priceChangePercent));
        topMover = { symbol: filtered[0].symbol, change: +filtered[0].priceChangePercent };
      }
    } catch (e) {}

    let fngValue = null;
    try {
      const r = await fetch('https://api.alternative.me/fng/?limit=1');
      const d = await r.json();
      fngValue = d.data?.[0]?.value || null;
    } catch (e) {}

    res.json({ totalPnl, signalAccuracy, totalSignals: allSignals.length, bestSignal, topMover, fngValue });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/recommendation', async (req, res) => {
  try {
    const data = await quickAnalysis('daily_recommendation', {
      date: new Date().toISOString().slice(0, 10)
    });

    res.json({
      recommendation: data?.choices?.[0]?.message?.content || 'Торгуйте осторожно'
    });
  } catch (e) {
    res.json({ recommendation: 'Следите за рынком' });
  }
});

module.exports = router;
