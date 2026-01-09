const { app, db, mockFetch, createTestUser } = require('./setup');
const request = require('supertest');

const { checkAlerts } = require('../services/alertChecker');
const { checkTradeTPSL } = require('../services/tradeChecker');
const { checkAiLimit, getAiUsageKey, dailyAiUsage } = require('../middleware/rateLimit');

describe('AlertChecker service', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test('checkAlerts - no active alerts does nothing', async () => {

    db.prepare('DELETE FROM alerts').run();
    await checkAlerts();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('checkAlerts - triggers alert when condition met (above)', async () => {
    db.prepare('DELETE FROM alerts').run();
    const r = db.prepare('INSERT INTO alerts (pair, condition, value, message) VALUES (?,?,?,?)').run('BTCUSDT', 'above', 50000, 'test');

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve([{ symbol: 'BTCUSDT', price: '55000' }])
    });

    await checkAlerts();

    var alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(r.lastInsertRowid);
    expect(alert.status).toBe('triggered');
  });

  test('checkAlerts - does NOT trigger when condition not met', async () => {
    db.prepare('DELETE FROM alerts').run();
    const r = db.prepare('INSERT INTO alerts (pair, condition, value, message) VALUES (?,?,?,?)').run('BTCUSDT', 'above', 60000, 'test');

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve([{ symbol: 'BTCUSDT', price: '55000' }])
    });

    await checkAlerts();

    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(r.lastInsertRowid);
    expect(alert.status).toBe('active');
  });

  test('checkAlerts - below condition', async () => {
    db.prepare('DELETE FROM alerts').run();
    const r = db.prepare('INSERT INTO alerts (pair, condition, value, message) VALUES (?,?,?,?)').run('ETHUSDT', 'below', 3000, 'dip');

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve([{ symbol: 'ETHUSDT', price: '2500' }])
    });

    await checkAlerts();
    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(r.lastInsertRowid);
    expect(alert.status).toBe('triggered');
  });

  test('checkAlerts - handles fetch error gracefully', async () => {
    db.prepare('DELETE FROM alerts').run();
    db.prepare('INSERT INTO alerts (pair, condition, value, message) VALUES (?,?,?,?)').run('BTCUSDT', 'above', 50000, 'test');

    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await checkAlerts();
  });

  test('checkAlerts - cross_above and cross_below', async () => {
    db.prepare('DELETE FROM alerts').run();
    const r1 = db.prepare('INSERT INTO alerts (pair, condition, value, message) VALUES (?,?,?,?)').run('BTCUSDT', 'cross_above', 50000, 'cross up');
    const r2 = db.prepare('INSERT INTO alerts (pair, condition, value, message) VALUES (?,?,?,?)').run('ETHUSDT', 'cross_below', 3000, 'cross down');

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve([
        { symbol: 'BTCUSDT', price: '51000' },
        { symbol: 'ETHUSDT', price: '2900' }
      ])
    });

    await checkAlerts();
    expect(db.prepare('SELECT status FROM alerts WHERE id = ?').get(r1.lastInsertRowid).status).toBe('triggered');
    expect(db.prepare('SELECT status FROM alerts WHERE id = ?').get(r2.lastInsertRowid).status).toBe('triggered');
  });
});

describe('TradeChecker service', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test('checkTradeTPSL - no open trades does nothing', async () => {
    db.prepare("DELETE FROM trades WHERE status = 'open'").run();
    await checkTradeTPSL();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('checkTradeTPSL - auto-closes long trade on TP', async () => {
    db.prepare("DELETE FROM trades WHERE status = 'open'").run();
    const r = db.prepare('INSERT INTO trades (pair, direction, quantity, entry_price, tp, sl) VALUES (?,?,?,?,?,?)')
      .run('BTCUSDT', 'long', 1, 50000, 55000, 48000);

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve([{ symbol: 'BTCUSDT', price: '56000' }])
    });

    await checkTradeTPSL();
    var trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(r.lastInsertRowid);
    expect(trade.status).toBe('closed');
    expect(trade.pnl).toBe(6000);
  });

  test('checkTradeTPSL - auto-closes long trade on SL', async () => {
    db.prepare("DELETE FROM trades WHERE status = 'open'").run();
    const r = db.prepare('INSERT INTO trades (pair, direction, quantity, entry_price, tp, sl) VALUES (?,?,?,?,?,?)')
      .run('BTCUSDT', 'long', 2, 50000, 55000, 48000);

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve([{ symbol: 'BTCUSDT', price: '47000' }])
    });

    await checkTradeTPSL();
    var trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(r.lastInsertRowid);
    expect(trade.status).toBe('closed');
    expect(trade.pnl).toBe(-6000);
  });

  test('checkTradeTPSL - short trade TP', async () => {
    db.prepare("DELETE FROM trades WHERE status = 'open'").run();
    var r = db.prepare('INSERT INTO trades (pair, direction, quantity, entry_price, tp, sl) VALUES (?,?,?,?,?,?)')
      .run('ETHUSDT', 'short', 10, 3000, 2700, 3200);

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve([{ symbol: 'ETHUSDT', price: '2600' }])
    });

    await checkTradeTPSL();
    var trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(r.lastInsertRowid);
    expect(trade.status).toBe('closed');
    expect(trade.pnl).toBe(4000);
  });

  test('checkTradeTPSL - handles fetch error gracefully', async () => {
    db.prepare("DELETE FROM trades WHERE status = 'open'").run();
    db.prepare('INSERT INTO trades (pair, direction, quantity, entry_price, tp, sl) VALUES (?,?,?,?,?,?)')
      .run('BTCUSDT', 'long', 1, 50000, 55000, 48000);
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    await checkTradeTPSL();
  });

  test('checkTradeTPSL - no TP/SL set, does not close', async () => {
    db.prepare("DELETE FROM trades WHERE status = 'open'").run();
    const r = db.prepare('INSERT INTO trades (pair, direction, quantity, entry_price) VALUES (?,?,?,?)')
      .run('BTCUSDT', 'long', 1, 50000);

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve([{ symbol: 'BTCUSDT', price: '60000' }])
    });

    await checkTradeTPSL();
    const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(r.lastInsertRowid);
    expect(trade.status).toBe('open');
  });
});

describe('Rate limiting', () => {
  test('getAiUsageKey generates daily key', () => {
    const key = getAiUsageKey(42);
    const today = new Date().toISOString().slice(0, 10);
    expect(key).toBe(`42_${today}`);
  });

  test('getAiUsageKey handles null userId', () => {
    const key = getAiUsageKey(null);
    expect(key).toContain('anon');
  });

  test('checkAiLimit returns true for Premium (unlimited)', () => {
    const req = { user: { plan: 'Premium' }, userId: 'prem1' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    expect(checkAiLimit(req, res)).toBe(true);
  });

  test('checkAiLimit returns true when under limit', () => {
    const userId = `ratelimit_test_${Date.now()}`;
    const req = { user: { plan: 'Free' }, userId };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    expect(checkAiLimit(req, res)).toBe(true);
  });

  test('checkAiLimit returns false after exceeding Free limit', () => {
    const userId = `exceeded_${Date.now()}`;
    const key = getAiUsageKey(userId);
    dailyAiUsage[key] = 5;

    const req = { user: { plan: 'Free' }, userId };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    expect(checkAiLimit(req, res)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(429);
  });

  test('checkAiLimit increments usage counter', () => {
    const userId = `inc_${Date.now()}`;
    const key = getAiUsageKey(userId);
    const req = { user: { plan: 'Pro' }, userId };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    checkAiLimit(req, res);
    expect(dailyAiUsage[key]).toBe(1);
    checkAiLimit(req, res);
    expect(dailyAiUsage[key]).toBe(2);
  });
});
