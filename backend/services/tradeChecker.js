const db = require('../config/database');

// проверка TP/SL для paper trading — вызывается периодически из server.js
async function checkTradeTPSL() {
  try {
    const openTrades = await db.getMany(
      "SELECT * FROM trades WHERE status = 'open'"
    );

    if (openTrades.length === 0) return;

    const r = await fetch('https://api.binance.com/api/v3/ticker/price');
    const prices = await r.json();
    const priceMap = {};
    prices.forEach(p => { priceMap[p.symbol] = +p.price; });

    for (const trade of openTrades) {
      const currentPrice = priceMap[trade.pair];
      if (!currentPrice) continue;

      let shouldClose = false;
      if (trade.direction === 'long') {
        if (trade.tp && currentPrice >= trade.tp) shouldClose = true;
        if (trade.sl && currentPrice <= trade.sl) shouldClose = true;
      } else {
        if (trade.tp && currentPrice <= trade.tp) shouldClose = true;
        if (trade.sl && currentPrice >= trade.sl) shouldClose = true;
      }

      if (shouldClose) {
        const pnl = trade.direction === 'long'
          ? (currentPrice - trade.entry_price) * trade.quantity
          : (trade.entry_price - currentPrice) * trade.quantity;

        await db.query(
          'UPDATE trades SET status = $1, close_price = $2, pnl = $3, closed_at = CURRENT_TIMESTAMP WHERE id = $4',
          ['closed', currentPrice, pnl, trade.id]
        );
        console.log(` Trade auto-closed: ${trade.pair} ${trade.direction} PnL: ${pnl.toFixed(2)}`);
      }
    }
  } catch (e) {
    console.error('Trade TP/SL check error:', e.message);
  }
}

module.exports = { checkTradeTPSL };
