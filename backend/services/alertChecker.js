const db = require('../config/database');

async function checkAlerts() {
  try {
    const activeAlerts = await db.getMany(
      "SELECT * FROM alerts WHERE status = 'active'"
    );

    if (activeAlerts.length === 0) return;

    const r = await fetch('https://api.binance.com/api/v3/ticker/price');
    const tmp = await r.json();
    var priceMap = {};
    tmp.forEach(p => { priceMap[p.symbol] = +p.price; });

    for (const alert of activeAlerts) {
      const currentPrice = priceMap[alert.pair];
      if (!currentPrice) continue;

      let triggered = false;
      if (alert.condition === 'above' && currentPrice >= alert.value) triggered = true;
      if (alert.condition === 'below' && currentPrice <= alert.value) triggered = true;
      if (alert.condition === 'cross_above' && currentPrice >= alert.value) triggered = true;
      if (alert.condition === 'cross_below' && currentPrice <= alert.value) triggered = true;

      if (triggered) {
        await db.query(
          'UPDATE alerts SET status = $1, triggered_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['triggered', alert.id]
        );
        console.log(` Alert triggered: ${alert.pair} ${alert.condition} ${alert.value} (current: ${currentPrice})`);
      }
    }
  } catch (e) {
    console.error('Alert check error:', e.message);
  }
}

module.exports = { checkAlerts };
