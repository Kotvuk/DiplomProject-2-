const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { generateReflection } = require('../services/signalChecker');

router.get('/', async (req, res) => {
  try {
    const signals = await db.getMany(
      'SELECT * FROM signals ORDER BY created_at DESC LIMIT 20'
    );
    res.json(signals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { pair, type, entry, tp, sl, reason, accuracy } = req.body;

    const result = await db.query(
      'INSERT INTO signals (pair, type, entry, tp, sl, reason, accuracy) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [pair, type, entry, tp, sl, reason, accuracy]
    );

    res.json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const signals = await db.getMany(
      'SELECT * FROM signal_results ORDER BY created_at DESC LIMIT 50'
    );
    res.json(signals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const all = await db.getMany(
      "SELECT * FROM signal_results WHERE result != $1",
      ['pending']
    );

    const total = all.length;
    const tpHit = all.filter(s => s.result === 'tp_hit').length;
    const slHit = all.filter(s => s.result === 'sl_hit').length;
    const timeout = all.filter(s => s.result === 'timeout').length;
    const accuracy = total > 0 ? (tpHit / total * 100) : 0;
    const avgScore = total > 0 ? (all.reduce((s, r) => s + (r.accuracy_score || 0), 0) / total) : 0;

    const pendingResult = await db.getOne(
      "SELECT COUNT(*) as cnt FROM signal_results WHERE result = $1",
      ['pending']
    );

    res.json({
      total, tpHit, slHit, timeout,
      accuracy, avgScore,
      pending: parseInt(pendingResult?.cnt || 0)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/track', async (req, res) => {
  try {
    const { pair, direction, entry_price, tp_price, sl_price, ai_analysis, confidence, coin_score } = req.body;

    if (!pair || !entry_price) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const result = await db.query(
      `INSERT INTO signal_results (pair, direction, entry_price, tp_price, sl_price, ai_analysis, confidence, coin_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [pair, direction || null, +entry_price, tp_price ? +tp_price : null, sl_price ? +sl_price : null, ai_analysis || null, confidence ? +confidence : null, coin_score ? +coin_score : null]
    );

    res.json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/resolve', async (req, res) => {
  try {
    const { result, actual_price } = req.body;

    const sig = await db.getOne(
      'SELECT * FROM signal_results WHERE id = $1',
      [req.params.id]
    );

    if (!sig) {
      return res.status(404).json({ error: 'Signal not found' });
    }

    const validResults = ['tp_hit', 'sl_hit', 'timeout'];
    if (!validResults.includes(result)) {
      return res.status(400).json({ error: 'Invalid result' });
    }

    let score = 0;
    if (result === 'tp_hit') score = 100;
    else if (result === 'timeout') score = 50;

    await db.query(
      'UPDATE signal_results SET result = $1, actual_price = $2, accuracy_score = $3, resolved_at = CURRENT_TIMESTAMP WHERE id = $4',
      [result, actual_price ? +actual_price : null, score, sig.id]
    );

    generateReflection(sig.id).catch(e => console.error('Reflection error:', e.message));

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
