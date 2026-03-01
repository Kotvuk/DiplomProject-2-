const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.post('/', async (req, res) => {
  try {
    const { pair, condition, value, message } = req.body;

    if (!pair || !condition || !value) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const userId = req.user?.id || null;

    const result = await db.query(
      `INSERT INTO alerts (pair, condition, value, message, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [pair, condition, +value, message || '', userId]
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
    const { status } = req.query;

    let query, params;

    if (status) {
      query = `SELECT * FROM alerts WHERE status = $1 AND (user_id = $2 OR user_id IS NULL) ORDER BY created_at DESC`;
      params = [status, userId];
    } else {
      query = `SELECT * FROM alerts WHERE (user_id = $1 OR user_id IS NULL) ORDER BY created_at DESC`;
      params = [userId];
    }

    const alerts = await db.getMany(query, params);
    res.json(alerts);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/triggered', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { since } = req.query;

    let query, params;

    if (since) {
      query = `SELECT * FROM alerts WHERE status = $1 AND triggered_at > $2 AND (user_id = $3 OR user_id IS NULL) ORDER BY triggered_at DESC`;
      params = ['triggered', since, userId];
    } else {
      query = `SELECT * FROM alerts WHERE status = $1 AND (user_id = $2 OR user_id IS NULL) ORDER BY triggered_at DESC LIMIT 10`;
      params = ['triggered', userId];
    }

    const alerts = await db.getMany(query, params);
    res.json(alerts);

  } catch (error) {
    res.status(500).json({ error: 'internal error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;

    await db.query(
      `DELETE FROM alerts WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`,
      [req.params.id, userId]
    );

    res.json({ ok: true });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
