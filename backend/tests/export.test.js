const { app, db, mockFetch } = require('./setup');
const request = require('supertest');

describe('Export endpoints', () => {
  beforeAll(() => {

    db.prepare('INSERT INTO trades (pair, direction, quantity, entry_price, tp, sl, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run('BTCUSDT', 'long', 0.1, 50000, 55000, 48000, 'open');
    db.prepare('INSERT INTO trades (pair, direction, quantity, entry_price, close_price, pnl, status, closed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('ETHUSDT', 'long', 1, 3000, 3500, 500, 'closed', '2024-01-15 12:00:00');
    db.prepare('INSERT INTO trades (pair, direction, quantity, entry_price, close_price, pnl, status, closed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('BNBUSDT', 'short', 2, 400, 350, 100, 'closed', '2024-01-16 12:00:00');
  });

  test('GET /api/export/trades/csv - all trades', async () => {
    const res = await request(app).get('/api/export/trades/csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('BTCUSDT');
    expect(res.text).toContain('ETHUSDT');
  });

  test('GET /api/export/trades/csv - filter by status', async () => {
    const res = await request(app).get('/api/export/trades/csv?status=closed');
    expect(res.status).toBe(200);
    expect(res.text).toContain('ETHUSDT');
    expect(res.text).not.toContain('open');
  });

  test('GET /api/export/trades/pdf - all trades', async () => {
    const res = await request(app).get('/api/export/trades/pdf');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('GET /api/export/signals/csv', async () => {
    const res = await request(app).get('/api/export/signals/csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });

  test('GET /api/export/analytics/pdf', async () => {
    const res = await request(app).get('/api/export/analytics/pdf');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });
});
