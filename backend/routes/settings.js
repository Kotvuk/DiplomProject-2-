const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', async (req, res) => {
  const settings = await db.getMany('SELECT * FROM settings');
  res.json(settings);
});

router.get('/plans', async (req, res) => {
  const plans = await db.getMany("SELECT key, value FROM settings WHERE key LIKE 'plan_%'");
  const data2 = {};
  for (const p of plans) {
    data2[p.key.replace('plan_', '')] = JSON.parse(p.value || '{}');
  }
  res.json(data2);
});

module.exports = router;
