const express = require('express');
var router = express.Router();
const db = require('../config/database');
const { hashPassword, comparePassword, needsRehash, generateTokens, verifyRefreshToken } = require('../utils/crypto');
const {
  generateSecret,
  verifyTOTP,
  generateOtpAuthUrl,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode
} = require('../utils/twoFactor');

const loginAttempts = new Map();

function checkLoginRateLimit(ip) {
  const now = Date.now();
  const key = ip;
  const attempts = loginAttempts.get(key) || { count: 0, resetAt: now + 15 * 60 * 1000 };

  if (now > attempts.resetAt) {
    attempts.count = 0;
    attempts.resetAt = now + 15 * 60 * 1000;
  }

  attempts.count++;
  loginAttempts.set(key, attempts);

  if (attempts.count > 5) {
    var waitTime = Math.ceil((attempts.resetAt - now) / 1000 / 60);
    return { blocked: true, waitTime };
  }

  return { blocked: false, attemptsLeft: 5 - attempts.count };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of loginAttempts.entries()) {
    if (now > value.resetAt) loginAttempts.delete(key);
  }
}, 60000);

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await db.getOne('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    const hash = await hashPassword(password);

    const result = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [name || '', normalizedEmail, hash]
    );

    const userId = result.rows[0].id;
    const { accessToken, refreshToken } = generateTokens({ id: userId });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: userId,
        name,
        email: normalizedEmail,
        plan: 'Free',
        is_admin: false,
        two_factor_enabled: false
      }
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, totpCode, backupCode } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    const ip = req.ip || req.connection.remoteAddress;
    var rateLimit = checkLoginRateLimit(ip);

    if (rateLimit.blocked) {
      return res.status(429).json({
        error: `Слишком много попыток входа. Попробуйте через ${rateLimit.waitTime} минут.`
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.getOne('SELECT * FROM users WHERE email = $1', [normalizedEmail]);

    if (!user || !await comparePassword(password, user.password_hash)) {
      return res.status(401).json({
        error: 'Неверный email или пароль',
        attemptsLeft: rateLimit.attemptsLeft
      });
    }

    if (user.two_factor_enabled) {
      if (!totpCode && !backupCode) {
        return res.json({
          requiresTwoFactor: true,
          message: 'Введите код из приложения-аутентификатора'
        });
      }

      if (totpCode) {
        if (!verifyTOTP(user.two_factor_secret, totpCode)) {
          return res.status(401).json({ error: 'Неверный код 2FA' });
        }
      }

      if (backupCode) {
        const backupCodes = JSON.parse(user.two_factor_backup_codes || '[]');
        let validBackupCode = false;

        for (let i = 0; i < backupCodes.length; i++) {
          if (verifyBackupCode(backupCodes[i], backupCode)) {
            backupCodes.splice(i, 1);
            await db.query('UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2', [JSON.stringify(backupCodes), user.id]);
            validBackupCode = true;
            break;
          }
        }

        if (!validBackupCode) {
          return res.status(401).json({ error: 'Неверный резервный код' });
        }
      }

      loginAttempts.delete(ip);
    }

    if (needsRehash(user.password_hash)) {
      const newHash = await hashPassword(password);
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
    }

    loginAttempts.delete(ip);

    const { accessToken, refreshToken } = generateTokens({ id: user.id });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        is_admin: user.is_admin,
        two_factor_enabled: !!user.two_factor_enabled
      }
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (e) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = await db.getOne(
      'SELECT id, name, email, plan, is_admin, two_factor_enabled FROM users WHERE id = $1',
      [payload.id]
    );

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const tokens = generateTokens({ id: user.id });

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        ...user,
        two_factor_enabled: !!user.two_factor_enabled
      }
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Не авторизован' });

  const user = await db.getOne(
    'SELECT id, email, name, plan, is_admin, two_factor_enabled FROM users WHERE id = $1',
    [req.user.id]
  );

  res.json({
    ...user,
    two_factor_enabled: !!user.two_factor_enabled
  });
});

router.patch('/me', requireAuth, async (req, res) => {
  const { name, email } = req.body;

  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (email) {
      const existing = await db.getOne(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email.toLowerCase().trim(), req.user.id]
      );
      if (existing) return res.status(409).json({ error: 'Email already taken' });
    }

    await db.query(
      'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email) WHERE id = $3',
      [name || null, email ? email.toLowerCase().trim() : null, req.user.id]
    );

    const updated = await db.getOne(
      'SELECT id, email, name, plan, is_admin, two_factor_enabled FROM users WHERE id = $1',
      [req.user.id]
    );

    res.json({
      ...updated,
      two_factor_enabled: !!updated.two_factor_enabled
    });

  } catch (e) {
    res.status(500).json({ error: 'Update failed' });
  }
});

router.post('/2fa/setup', requireAuth, async (req, res) => {
  try {
    const user = await db.getOne('SELECT * FROM users WHERE id = $1', [req.user.id]);

    if (user.two_factor_enabled) {
      return res.status(400).json({ error: '2FA уже включена. Сначала отключите её.' });
    }

    const secret = generateSecret();
    const backupCodes = generateBackupCodes(10);
    const otpAuthUrl = generateOtpAuthUrl(user.email, secret);

    await db.query(
      'UPDATE users SET two_factor_secret = $1, two_factor_backup_codes = $2 WHERE id = $3',
      [secret, JSON.stringify(backupCodes.map(code => hashBackupCode(code))), user.id]
    );

    res.json({
      secret,
      otpAuthUrl,
      backupCodes,
      message: 'Отсканируйте QR код в Google Authenticator или Authy, затем введите код для подтверждения'
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/2fa/verify', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;

    const user = await db.getOne('SELECT * FROM users WHERE id = $1', [req.user.id]);

    if (!user.two_factor_secret) {
      return res.status(400).json({ error: 'Сначала инициализируйте 2FA' });
    }

    if (!verifyTOTP(user.two_factor_secret, code)) {
      return res.status(400).json({ error: 'Неверный код' });
    }

    await db.query(
      'UPDATE users SET two_factor_enabled = true, two_factor_verified_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    res.json({ success: true, message: '2FA успешно включена!' });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/2fa/disable', requireAuth, async (req, res) => {
  try {
    const { password, code } = req.body;

    const user = await db.getOne('SELECT * FROM users WHERE id = $1', [req.user.id]);

    if (!await comparePassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Неверный пароль' });
    }

    if (user.two_factor_enabled && !verifyTOTP(user.two_factor_secret, code)) {
      return res.status(400).json({ error: 'Неверный код 2FA' });
    }

    await db.query(
      'UPDATE users SET two_factor_enabled = false, two_factor_secret = NULL, two_factor_backup_codes = NULL WHERE id = $1',
      [user.id]
    );

    res.json({ success: true, message: '2FA отключена' });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/2fa/status', requireAuth, async (req, res) => {
  const user = await db.getOne(
    'SELECT two_factor_enabled, two_factor_verified_at FROM users WHERE id = $1',
    [req.user.id]
  );

  res.json({
    enabled: !!user.two_factor_enabled,
    verifiedAt: user.two_factor_verified_at
  });
});

router.post('/2fa/backup-codes', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;

    const user = await db.getOne('SELECT * FROM users WHERE id = $1', [req.user.id]);

    if (!user.two_factor_enabled) {
      return res.status(400).json({ error: '2FA не включена' });
    }

    if (!await comparePassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Неверный пароль' });
    }

    const backupCodes = generateBackupCodes(10);

    await db.query(
      'UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2',
      [JSON.stringify(backupCodes.map(code => hashBackupCode(code))), user.id]
    );

    res.json({
      backupCodes,
      message: 'Сохраните эти коды в безопасном месте. Они показываются только один раз!'
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
