const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { hashPassword, generateTokens } = require('../utils/crypto');
const { requireAdmin } = require('../middleware/auth');

router.post('/setup', async (req, res) => {
  try {
    const adminResult = await db.getOne('SELECT COUNT(*) as count FROM users WHERE is_admin = 1');

    if (parseInt(adminResult.count) > 0) {
      return res.status(400).json({ error: 'Admin already exists' });
    }

    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await db.getOne('SELECT id FROM users WHERE email = $1', [email]);
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const hash = await hashPassword(password);

    const result = await db.query(
      'INSERT INTO users (name, email, password_hash, is_admin) VALUES ($1, $2, $3, 1) RETURNING id',
      [name || '', email, hash]
    );

    const { accessToken, refreshToken } = generateTokens({ id: result.rows[0].id });

    res.json({
      accessToken,
      refreshToken,
      user: { id: result.rows[0].id, name, email, plan: 'Free', is_admin: true }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await db.getMany(
      'SELECT id, name, email, plan, is_admin, two_factor_enabled, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(users.map(u => ({ ...u, two_factor_enabled: !!u.two_factor_enabled })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/users/:id/plan', requireAdmin, async (req, res) => {
  try {
    const { plan } = req.body;

    if (!['Free', 'Pro', 'Premium'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    await db.query('UPDATE users SET plan = $1 WHERE id = $2', [plan, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/users/:id/admin', requireAdmin, async (req, res) => {
  try {
    const { is_admin } = req.body;

    if (is_admin !== 0 && is_admin !== 1) {
      return res.status(400).json({ error: 'is_admin must be 0 or 1' });
    }

    if (req.user.id === parseInt(req.params.id) && is_admin === 0) {
      return res.status(400).json({ error: 'Cannot remove admin status from yourself' });
    }

    await db.query('UPDATE users SET is_admin = $1 WHERE id = $2', [is_admin, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    if (req.user.id === parseInt(req.params.id)) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const totalUsers = await db.getOne('SELECT COUNT(*) as count FROM users');
    const freeUsers = await db.getOne("SELECT COUNT(*) as count FROM users WHERE plan = 'Free'");
    const proUsers = await db.getOne("SELECT COUNT(*) as count FROM users WHERE plan = 'Pro'");
    const premiumUsers = await db.getOne("SELECT COUNT(*) as count FROM users WHERE plan = 'Premium'");
    const totalTrades = await db.getOne('SELECT COUNT(*) as count FROM trades');
    const totalSignals = await db.getOne('SELECT COUNT(*) as count FROM signal_results');

    const resolvedSignals = await db.getMany(
      "SELECT * FROM signal_results WHERE result != 'pending'"
    );

    const tpHit = resolvedSignals.filter(s => s.result === 'tp_hit').length;
    const signalAccuracy = resolvedSignals.length > 0
      ? (tpHit / resolvedSignals.length * 100)
      : 0;

    res.json({
      totalUsers: parseInt(totalUsers?.count || 0),
      usersByPlan: {
        Free: parseInt(freeUsers?.count || 0),
        Pro: parseInt(proUsers?.count || 0),
        Premium: parseInt(premiumUsers?.count || 0)
      },
      totalTrades: parseInt(totalTrades?.count || 0),
      totalSignals: parseInt(totalSignals?.count || 0),
      signalAccuracy: parseFloat(signalAccuracy.toFixed(2))
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/signals', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const signals = await db.getMany(
      'SELECT * FROM signal_results ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    const totalResult = await db.getOne('SELECT COUNT(*) as count FROM signal_results');
    const total = parseInt(totalResult?.count || 0);

    res.json({
      signals,
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/plans/:plan', requireAdmin, async (req, res) => {
  try {
    const planName = req.params.plan;

    if (!['Free', 'Pro', 'Premium'].includes(planName)) {
      return res.status(400).json({ error: 'Invalid plan name' });
    }

    await db.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [`plan_${planName}`, JSON.stringify(req.body)]
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await db.getMany('SELECT key, value FROM settings');
    const result = {};
    for (const s of settings) {
      result[s.key] = JSON.parse(s.value || '{}');
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
