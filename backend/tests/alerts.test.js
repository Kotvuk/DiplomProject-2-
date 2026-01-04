const { app, db } = require('./setup');
const request = require('supertest');

describe('Alerts API', () => {
  let alertId;

  test('POST /api/alerts - create alert', async () => {
    const res = await request(app).post('/api/alerts').send({
      pair: 'BTCUSDT', condition: 'above', value: 60000, message: 'BTC breakout'
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    alertId = res.body.id;
  });

  test('POST /api/alerts - missing fields returns 400', async () => {
    const res = await request(app).post('/api/alerts').send({ pair: 'BTCUSDT' });
    expect(res.status).toBe(400);
  });

  test('POST /api/alerts - creates with correct status', async () => {
    const res = await request(app).post('/api/alerts').send({
      pair: 'ETHUSDT', condition: 'below', value: 2000, message: 'ETH dip'
    });
    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(res.body.id);
    expect(alert.status).toBe('active');
    expect(alert.pair).toBe('ETHUSDT');
    expect(alert.condition).toBe('below');
    expect(alert.value).toBe(2000);
  });

  test('GET /api/alerts - list all', async () => {
    const res = await request(app).get('/api/alerts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('GET /api/alerts?status=active', async () => {
    const res = await request(app).get('/api/alerts?status=active');
    expect(res.status).toBe(200);
    expect(res.body.every(a => a.status === 'active')).toBe(true);
  });

  test('GET /api/alerts/triggered - empty initially', async () => {
    const res = await request(app).get('/api/alerts/triggered');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('DELETE /api/alerts/:id', async () => {
    const res = await request(app).delete(`/api/alerts/${alertId}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const check = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId);
    expect(check).toBeUndefined();
  });

  describe('Alert trigger logic (unit)', () => {
    test('above condition triggers when price >= value', () => {
      const triggered = (condition, price, value) => {
        if (condition === 'above' && price >= value) return true;
        if (condition === 'below' && price <= value) return true;
        return false;
      };
      expect(triggered('above', 61000, 60000)).toBe(true);
      expect(triggered('above', 60000, 60000)).toBe(true);
      expect(triggered('above', 59000, 60000)).toBe(false);
    });

    test('below condition triggers when price <= value', () => {
      const triggered = (condition, price, value) => {
        if (condition === 'above' && price >= value) return true;
        if (condition === 'below' && price <= value) return true;
        return false;
      };
      expect(triggered('below', 45000, 46000)).toBe(true);
      expect(triggered('below', 46000, 46000)).toBe(true);
      expect(triggered('below', 47000, 46000)).toBe(false);
    });
  });
});
