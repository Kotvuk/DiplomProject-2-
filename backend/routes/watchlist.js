const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.post('/', async (req, res) => {
  try {
    const { pair } = req.body;
    if (!pair) return res.status(400).json({ error: 'pair required' });

    const userId = req.user?.id || null;

    const existing = await db.getOne(
      'SELECT id FROM watchlist WHERE pair = $1 AND (user_id = $2 OR user_id IS NULL)',
      [pair, userId]
    );

    if (existing) {
      return res.json({ id: existing.id, exists: true });
    }

    const result = await db.query(
      'INSERT INTO watchlist (pair, user_id) VALUES ($1, $2) RETURNING id',
      [pair, userId]
    );

    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).send('server error');
  }
});

router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    const watchlist = await db.getMany(
      'SELECT * FROM watchlist WHERE (user_id = $1 OR user_id IS NULL) ORDER BY added_at DESC',
      [userId]
    );
    res.json(watchlist);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/pair/:pair', async (req, res) => {
  const userId = req.user?.id;
  await db.query(
    'DELETE FROM watchlist WHERE pair = $1 AND (user_id = $2 OR user_id IS NULL)',
    [req.params.pair, userId]
  );
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    await db.query(
      'DELETE FROM watchlist WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
      [req.params.id, userId]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
