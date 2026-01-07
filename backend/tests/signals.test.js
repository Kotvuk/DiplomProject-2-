const { app, db, mockFetch } = require('./setup');
const request = require('supertest');

describe('Signals API', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({}), ok: true });
  });

  test('POST /api/signals - save signal', async () => {
    const res = await request(app).post('/api/signals').send({
      pair: 'BTCUSDT', type: 'LONG', entry: 50000, tp: 55000, sl: 48000,
      reason: 'Bullish EMA cross', accuracy: 85
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
  });

  test('GET /api/signals - list signals', async () => {
    const res = await request(app).get('/api/signals');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('pair');
  });

  test('POST /api/signals/track - track signal result', async () => {
    const res = await request(app).post('/api/signals/track').send({
      pair: 'BTCUSDT', direction: 'LONG', entry_price: 50000,
      tp_price: 55000, sl_price: 48000, confidence: 80, coin_score: 7
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
  });

  test('POST /api/signals/track - missing required fields', async () => {
    const res = await request(app).post('/api/signals/track').send({});
    expect(res.status).toBe(400);
  });

  test('GET /api/signals/history', async () => {
    const res = await request(app).get('/api/signals/history');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/signals/stats', async () => {
    const res = await request(app).get('/api/signals/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('tpHit');
    expect(res.body).toHaveProperty('slHit');
    expect(res.body).toHaveProperty('accuracy');
    expect(res.body).toHaveProperty('pending');
  });

  test('POST /api/signals/:id/resolve - tp_hit', async () => {
    const track = await request(app).post('/api/signals/track').send({
      pair: 'ETHUSDT', direction: 'SHORT', entry_price: 3000,
      tp_price: 2700, sl_price: 3200
    });

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        choices: [{ message: { content: 'Test reflection text' } }]
      })
    });

    const res = await request(app).post(`/api/signals/${track.body.id}/resolve`).send({
      result: 'tp_hit', actual_price: 2700
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const sig = db.prepare('SELECT * FROM signal_results WHERE id = ?').get(track.body.id);
    expect(sig.result).toBe('tp_hit');
    expect(sig.accuracy_score).toBe(100);
  });

  test('POST /api/signals/:id/resolve - sl_hit gives score 0', async () => {
    const track = await request(app).post('/api/signals/track').send({
      pair: 'SOLUSDT', direction: 'LONG', entry_price: 100
    });
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ choices: [{ message: { content: 'Reflection' } }] })
    });
    const res = await request(app).post(`/api/signals/${track.body.id}/resolve`).send({
      result: 'sl_hit', actual_price: 80
    });
    expect(res.status).toBe(200);
    const sig = db.prepare('SELECT * FROM signal_results WHERE id = ?').get(track.body.id);
    expect(sig.accuracy_score).toBe(0);
  });

  test('POST /api/signals/:id/resolve - invalid result', async () => {
    const track = await request(app).post('/api/signals/track').send({
      pair: 'ADAUSDT', direction: 'LONG', entry_price: 0.5
    });
    const res = await request(app).post(`/api/signals/${track.body.id}/resolve`).send({
      result: 'invalid_result'
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/signals/:id/resolve - nonexistent signal', async () => {
    var res = await request(app).post('/api/signals/99999/resolve').send({ result: 'tp_hit' });
    expect(res.status).toBe(404);
  });

  test('signal stats reflect resolved signals', async () => {
    const res = await request(app).get('/api/signals/stats');
    expect(res.body.tpHit).toBeGreaterThan(0);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.accuracy).toBeGreaterThan(0);
  });
});
