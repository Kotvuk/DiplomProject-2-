const { app } = require('./setup');
const request = require('supertest');

describe('Watchlist API', () => {
  let itemId;

  test('POST /api/watchlist - add pair', async () => {
    const res = await request(app).post('/api/watchlist').send({ pair: 'BTCUSDT' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    itemId = res.body.id;
  });

  test('POST /api/watchlist - duplicate uses INSERT OR IGNORE', async () => {
    const res = await request(app).post('/api/watchlist').send({ pair: 'BTCUSDT' });
    expect(res.status).toBe(200);

  });

  test('POST /api/watchlist - missing pair returns 400', async () => {
    const res = await request(app).post('/api/watchlist').send({});
    expect(res.status).toBe(400);
  });

  test('GET /api/watchlist - list all', async () => {
    const res = await request(app).get('/api/watchlist');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(w => w.pair === 'BTCUSDT')).toBe(true);
  });

  test('DELETE /api/watchlist/:id', async () => {
    const res = await request(app).delete(`/api/watchlist/${itemId}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('add multiple pairs', async () => {
    await request(app).post('/api/watchlist').send({ pair: 'ETHUSDT' });
    await request(app).post('/api/watchlist').send({ pair: 'SOLUSDT' });
    const res = await request(app).get('/api/watchlist');
    var pairs = res.body.map(w => w.pair);
    expect(pairs).toContain('ETHUSDT');
    expect(pairs).toContain('SOLUSDT');
  });
});
