const { app, db, mockFetch } = require('./setup');
const request = require('supertest');

describe('Trades API', () => {
  let tradeId;

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({}), ok: true });
  });

  test('POST /api/trades - create valid trade', async () => {
    var res = await request(app).post('/api/trades').send({
      pair: 'BTCUSDT', direction: 'long', quantity: 0.5, entry_price: 50000, tp: 55000, sl: 48000
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    tradeId = res.body.id;
  });

  test('POST /api/trades - missing required fields', async () => {
    const res = await request(app).post('/api/trades').send({ pair: 'BTCUSDT' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  test('POST /api/trades - without tp/sl (optional)', async () => {
    const res = await request(app).post('/api/trades').send({
      pair: 'ETHUSDT', direction: 'short', quantity: 10, entry_price: 3000
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
  });

  test('GET /api/trades - list all', async () => {
    const res = await request(app).get('/api/trades');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('GET /api/trades?status=open', async () => {
    const res = await request(app).get('/api/trades?status=open');
    expect(res.status).toBe(200);
    expect(res.body.every(t => t.status === 'open')).toBe(true);
  });

  test('POST /api/trades/:id/close - with explicit close_price (long)', async () => {
    const res = await request(app).post(`/api/trades/${tradeId}/close`).send({ close_price: 52000 });
    expect(res.status).toBe(200);

    expect(res.body.pnl).toBe(1000);
    expect(res.body.close_price).toBe(52000);
  });

  test('POST /api/trades/:id/close - already closed returns 404', async () => {
    const res = await request(app).post(`/api/trades/${tradeId}/close`).send({ close_price: 53000 });
    expect(res.status).toBe(404);
  });

  test('PnL calculation - short trade profit', async () => {
    const create = await request(app).post('/api/trades').send({
      pair: 'ETHUSDT', direction: 'short', quantity: 10, entry_price: 3000
    });
    var close = await request(app).post(`/api/trades/${create.body.id}/close`).send({ close_price: 2800 });

    expect(close.body.pnl).toBe(2000);
  });

  test('PnL calculation - long trade loss', async () => {
    const create = await request(app).post('/api/trades').send({
      pair: 'BTCUSDT', direction: 'long', quantity: 1, entry_price: 50000
    });
    var close = await request(app).post(`/api/trades/${create.body.id}/close`).send({ close_price: 48000 });
    expect(close.body.pnl).toBe(-2000);
  });

  test('POST /api/trades/:id/close - fetches price from Binance when no close_price', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ price: '51000' }), ok: true
    });
    const create = await request(app).post('/api/trades').send({
      pair: 'BTCUSDT', direction: 'long', quantity: 1, entry_price: 50000
    });
    const close = await request(app).post(`/api/trades/${create.body.id}/close`).send({});
    expect(close.status).toBe(200);
    expect(close.body.pnl).toBe(1000);
  });

  test('GET /api/trades/stats', async () => {
    const res = await request(app).get('/api/trades/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalPnl');
    expect(res.body).toHaveProperty('winRate');
    expect(res.body).toHaveProperty('avgPnl');
    expect(res.body).toHaveProperty('best');
    expect(res.body).toHaveProperty('worst');
    expect(res.body).toHaveProperty('total');
    expect(res.body.total).toBeGreaterThan(0);
  });

  test('trade stats - winRate is percentage', async () => {
    const res = await request(app).get('/api/trades/stats');
    expect(res.body.winRate).toBeGreaterThanOrEqual(0);
    expect(res.body.winRate).toBeLessThanOrEqual(100);
  });

  test('POST /api/calculator/risk - basic calculation', async () => {
    const res = await request(app).post('/api/calculator/risk').send({
      balance: 10000, riskPercent: 2, entryPrice: 50000, stopLoss: 49000, takeProfit: 52000
    });
    expect(res.status).toBe(200);
    expect(res.body.direction).toBe('long');
    expect(res.body.riskAmount).toBe(200);
    expect(res.body.positionSize).toBeGreaterThan(0);
    expect(res.body.rrRatio).toBe(2);
  });

  test('POST /api/calculator/risk - missing fields', async () => {
    const res = await request(app).post('/api/calculator/risk').send({ balance: 10000 });
    expect(res.status).toBe(400);
  });
});
