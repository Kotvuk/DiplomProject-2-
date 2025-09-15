const express = require('express');
const router = express.Router();

router.get('/orderbook', async (req, res) => {
  try {
    const { symbol = 'BTCUSDT' } = req.query;
    const r = await fetch(`https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=50`);
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/trades', async (req, res) => {
  try {
    const { symbol = 'BTCUSDT' } = req.query;
    const r = await fetch(`https://api.binance.com/api/v3/aggTrades?symbol=${symbol}&limit=500`);
    const data = await r.json();
    if (!Array.isArray(data)) return res.json([]);
    const pr = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    const pd = await pr.json();
    const price = +pd.price || 0;
    const large = data
      .map(t => ({ ...t, usdValue: +t.q * price }))
      .filter(t => t.usdValue >= 100000)
      .sort((a, b) => b.usdValue - a.usdValue);
    res.json(large);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
