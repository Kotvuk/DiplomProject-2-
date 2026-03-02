const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.post('/', async (req, res) => {
  try {
    const { pair, direction, quantity, entry_price, tp, sl, entry_amount } = req.body;

    if (!pair || !direction || !entry_price) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // если пришёл entry_amount вместо quantity — пересчитываем
    const actualQuantity = entry_amount ? entry_amount / entry_price : quantity;
    if (!actualQuantity) {
      return res.status(400).json({ error: 'Missing quantity or entry_amount' });
    }

    const userId = req.user?.id || null;

    const result = await db.query(
      `INSERT INTO trades (pair, direction, quantity, entry_price, tp, sl, entry_amount, user_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open')
       RETURNING id`,
      [pair, direction, actualQuantity, entry_price, tp || null, sl || null, entry_amount || null, userId]
    );

    res.json({ id: result.rows[0].id });

  } catch (err) {
    return res.json({ ok: false, msg: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { status } = req.query;

    let query, params;

    if (status) {
      query = `SELECT * FROM trades WHERE status = $1 AND (user_id = $2 OR user_id IS NULL) ORDER BY opened_at DESC`;
      params = [status, userId];
    } else {
      query = `SELECT * FROM trades WHERE (user_id = $1 OR user_id IS NULL) ORDER BY opened_at DESC`;
      params = [userId];
    }

    const trades = await db.getMany(query, params);
    res.json(trades);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const userId = req.user?.id;

    const closed = await db.getMany(
      `SELECT * FROM trades WHERE status = 'closed' AND (user_id = $1 OR user_id IS NULL)`,
      [userId]
    );

    const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
    const wins = closed.filter(t => (t.pnl || 0) > 0).length;
    const winRate = closed.length > 0 ? (wins / closed.length * 100) : 0;
    const avgPnl = closed.length > 0 ? totalPnl / closed.length : 0;
    const best = closed.length > 0 ? Math.max(...closed.map(t => t.pnl || 0)) : 0;
    const worst = closed.length > 0 ? Math.min(...closed.map(t => t.pnl || 0)) : 0;

    res.json({ totalPnl, winRate, avgPnl, best, worst, total: closed.length });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/close', async (req, res) => {
  try {
    const userId = req.user?.id;

    const trade = await db.getOne(
      `SELECT * FROM trades WHERE id = $1 AND status = $2 AND (user_id = $3 OR user_id IS NULL)`,
      [req.params.id, 'open', userId]
    );

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found or already closed' });
    }

    let closePrice = req.body.close_price;

    if (!closePrice) {
      try {
        const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${trade.pair}`);
        const d = await r.json();
        closePrice = +d.price;
      } catch {
        return res.status(500).json({ error: 'Cannot fetch price' });
      }
    }

    const pnl = trade.direction === 'long'
      ? (closePrice - trade.entry_price) * trade.quantity
      : (trade.entry_price - closePrice) * trade.quantity;

    await db.query(
      `UPDATE trades SET status = 'closed', close_price = $1, pnl = $2, closed_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [closePrice, pnl, trade.id]
    );

    res.json({ id: trade.id, pnl, close_price: closePrice });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/calculator/risk', (req, res) => {
  try {
    const { balance, riskPercent, entryPrice, stopLoss, takeProfit, leverage = 1 } = req.body;

    if (!balance || !riskPercent || !entryPrice || !stopLoss) {
      return res.status(400).json({ error: 'balance, riskPercent, entryPrice, stopLoss required' });
    }

    const riskAmount = balance * (riskPercent / 100);
    const direction = entryPrice > stopLoss ? 'long' : 'short';
    const slDistance = Math.abs(entryPrice - stopLoss);
    const slPercent = (slDistance / entryPrice) * 100;

    const positionSize = riskAmount / slDistance;
    const positionValue = positionSize * entryPrice;
    const requiredMargin = positionValue / leverage;

    let liquidationPrice;
    if (direction === 'long') {
      liquidationPrice = entryPrice * (1 - 1 / leverage);
    } else {
      liquidationPrice = entryPrice * (1 + 1 / leverage);
    }

    let rrRatio = null;
    let tpDistance = null;
    if (takeProfit) {
      tpDistance = Math.abs(takeProfit - entryPrice);
      rrRatio = +(tpDistance / slDistance).toFixed(2);
    }

    const potentialLoss = riskAmount;
    const potentialProfit = tpDistance ? positionSize * tpDistance : null;

    res.json({
      direction,
      positionSize: +positionSize.toFixed(6),
      positionValue: +positionValue.toFixed(2),
      requiredMargin: +requiredMargin.toFixed(2),
      riskAmount: +riskAmount.toFixed(2),
      slPercent: +slPercent.toFixed(2),
      liquidationPrice: +liquidationPrice.toFixed(2),
      rrRatio,
      potentialLoss: +potentialLoss.toFixed(2),
      potentialProfit: potentialProfit ? +potentialProfit.toFixed(2) : null,
      leverage
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
