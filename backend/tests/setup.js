process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-12345678901234567890';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-12345678901234567890';
process.env.GROQ_API_KEY = 'test-groq-key';

process.env.DATABASE_URL = process.env.DATABASE_URL;

const mockFetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({}),
    ok: true,
    status: 200
  })
);
global.fetch = mockFetch;

const { app } = require('../app');
const db = require('../config/database');
const { hashPassword, generateTokens, verifyAccessToken, verifyRefreshToken: _verifyRefreshToken } = require('../utils/crypto');

function createToken(payload) {
  return generateTokens(payload).accessToken;
}
function createRefreshToken(payload) {
  return generateTokens(payload).refreshToken;
}
function verifyToken(token) {
  try {
    if (!token) return null;
    return verifyAccessToken(token);
  } catch (e) {
    return null;
  }
}
function verifyRefreshToken(token) {
  try {
    if (!token) return null;
    return _verifyRefreshToken(token);
  } catch (e) {
    return null;
  }
}
const { calcEMA, calcEMASeries, calcRSI, calcRSISeries, calcMACD, calcMACDSeries, calcBollingerBands, calcBollingerSeries, calcIndicators } = require('../services/indicators');

async function createTestUser(overrides = {}) {
  const email = overrides.email || `test_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  var name = overrides.name || 'Test User';
  const password = overrides.password || 'password123';
  const hash = await hashPassword(password);

  const result = await db.query(
    'INSERT INTO users (name, email, password_hash, plan, is_admin) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [name, email, hash, overrides.plan || 'Free', overrides.is_admin || 0]
  );

  const userId = result.rows[0].id;
  const tokens = generateTokens({ id: userId });
  const token = tokens.accessToken;
  const refreshToken = tokens.refreshToken;

  return { id: userId, email, name, password, token, refreshToken };
}

async function cleanupTestUser(userId) {
  if (userId) {
    try {
      await db.query('DELETE FROM trades WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM alerts WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM watchlist WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    } catch (e) {

    }
  }
}

afterAll(async () => {

  await new Promise(resolve => setTimeout(resolve, 100));

  try {
    await db.pool.end();
  } catch (e) {

  }
});

module.exports = {
  app, db, hashPassword, generateTokens, createToken, createRefreshToken, verifyToken, verifyAccessToken, verifyRefreshToken,
  calcEMA, calcEMASeries, calcRSI, calcRSISeries, calcMACD, calcMACDSeries,
  calcBollingerBands, calcBollingerSeries, calcIndicators,
  mockFetch, createTestUser, cleanupTestUser
};
