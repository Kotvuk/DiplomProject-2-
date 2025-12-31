const { app, mockFetch, createTestUser } = require('./setup');
const request = require('supertest');

describe('API Integration Tests', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({}), ok: true });
  });

  describe('Market proxy routes', () => {
    test('GET /api/klines', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve([[1, '100', '110', '90', '105', '1000']])
      });
      const res = await request(app).get('/api/klines?symbol=BTCUSDT&interval=1h&limit=10');
      expect(res.status).toBe(200);
      expect(mockFetch).toHaveBeenCalled();
    });

    test('GET /api/price - with symbol', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ symbol: 'BTCUSDT', price: '50000.00' })
      });
      const res = await request(app).get('/api/price?symbol=BTCUSDT');
      expect(res.status).toBe(200);
    });

    test('GET /api/price - without symbol returns 400', async () => {
      const res = await request(app).get('/api/price');
      expect(res.status).toBe(400);
    });

    test('GET /api/prices - with symbols', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve([
          { symbol: 'BTCUSDT', price: '50000' },
          { symbol: 'ETHUSDT', price: '3000' },
          { symbol: 'DOGUSDT', price: '0.1' }
        ])
      });
      const res = await request(app).get('/api/prices?symbols=BTCUSDT,ETHUSDT');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/prices - no symbols returns empty array', async () => {
      const res = await request(app).get('/api/prices');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('GET /api/ticker24h', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve([
          { symbol: 'BTCUSDT', priceChangePercent: '2.5', quoteVolume: '1000000' },
          { symbol: 'XYZUSDT', priceChangePercent: '1.0', quoteVolume: '500' }
        ])
      });
      const res = await request(app).get('/api/ticker24h');
      expect(res.status).toBe(200);

      expect(res.body.every(t => ['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT','SOLUSDT','DOGEUSDT','DOTUSDT','MATICUSDT','AVAXUSDT'].includes(t.symbol))).toBe(true);
    });

    test('GET /api/ticker24h/single - with symbol', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ symbol: 'BTCUSDT', priceChangePercent: '2.5' })
      });
      const res = await request(app).get('/api/ticker24h/single?symbol=BTCUSDT');
      expect(res.status).toBe(200);
    });

    test('GET /api/ticker24h/single - without symbol returns 400', async () => {
      const res = await request(app).get('/api/ticker24h/single');
      expect(res.status).toBe(400);
    });

    test('GET /api/fng', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ data: [{ value: '75', value_classification: 'Greed' }] })
      });
      const res = await request(app).get('/api/fng');
      expect(res.status).toBe(200);
    });

    test('GET /api/exchangeInfo', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          symbols: [
            { symbol: 'BTCUSDT', quoteAsset: 'USDT', status: 'TRADING' },
            { symbol: 'ETHBTC', quoteAsset: 'BTC', status: 'TRADING' },
            { symbol: 'XRPUSDT', quoteAsset: 'USDT', status: 'BREAK' }
          ]
        })
      });
      const res = await request(app).get('/api/exchangeInfo');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(['BTCUSDT']);
    });

    test('GET /api/heatmap', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve([
          { symbol: 'BTCUSDT', quoteVolume: '5000000' },
          { symbol: 'BTCUPUSDT', quoteVolume: '1000000' }
        ])
      });
      const res = await request(app).get('/api/heatmap');
      expect(res.status).toBe(200);
    });

    test('GET /api/screener', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve([{ symbol: 'BTCUSDT', quoteVolume: '5000000' }])
      });
      const res = await request(app).get('/api/screener');
      expect(res.status).toBe(200);
    });

    test('GET /api/level2', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ bids: [['50000', '1']], asks: [['50001', '1']] })
      });
      const res = await request(app).get('/api/level2?symbol=BTCUSDT');
      expect(res.status).toBe(200);
    });

    test('GET /api/level2/spread', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ bids: [['50000', '1']], asks: [['50001', '1']] })
      });
      const res = await request(app).get('/api/level2/spread?symbol=BTCUSDT');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('spread');
      expect(res.body).toHaveProperty('spreadPct');
    });
  });

  describe('Whale routes', () => {
    test('GET /api/whale/orderbook', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ bids: [], asks: [] })
      });
      const res = await request(app).get('/api/whale/orderbook?symbol=BTCUSDT');
      expect(res.status).toBe(200);
    });

    test('GET /api/whale/trades', async () => {
      mockFetch
        .mockResolvedValueOnce({ json: () => Promise.resolve([{ q: '2', p: '50000' }]) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ price: '50000' }) });
      var res = await request(app).get('/api/whale/trades?symbol=BTCUSDT');
      expect(res.status).toBe(200);
    });
  });

  describe('News', () => {
    test('GET /api/news', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ Data: [{ title: 'BTC hits ATH' }] })
      });
      const res = await request(app).get('/api/news');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Settings', () => {
    test('GET /api/settings', async () => {
      const res = await request(app).get('/api/settings');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      expect(res.body.some(s => s.key === 'plan_Free')).toBe(true);
    });
  });

  describe('Dashboard', () => {
    test('GET /api/dashboard', async () => {
      mockFetch
        .mockResolvedValueOnce({ json: () => Promise.resolve([]) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ data: [{ value: '50' }] }) });
      const res = await request(app).get('/api/dashboard');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalPnl');
      expect(res.body).toHaveProperty('signalAccuracy');
      expect(res.body).toHaveProperty('totalSignals');
    });

    test('GET /api/dashboard/recommendation', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Торгуйте осторожно сегодня' } }]
        })
      });
      const res = await request(app).get('/api/dashboard/recommendation');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('recommendation');
    });
  });

  describe('AI usage', () => {
    test('GET /api/ai/usage', async () => {
      const res = await request(app).get('/api/ai/usage');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('used');
      expect(res.body).toHaveProperty('limit');
      expect(res.body).toHaveProperty('plan');
    });
  });

  describe('Error handling', () => {
    test('fetch failure returns 500 on proxy routes', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      var res = await request(app).get('/api/klines');
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });

    test('fetch failure on price route', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Timeout'));
      var res = await request(app).get('/api/price?symbol=BTCUSDT');
      expect(res.status).toBe(500);
    });
  });

  describe('Admin routes', () => {
    let adminToken;

    beforeAll(() => {
      const admin = createTestUser({ email: `admin_${Date.now()}@test.com`, is_admin: 1 });
      adminToken = admin.token;
    });

    test('GET /api/admin/users - requires admin', async () => {
      const res = await request(app).get('/api/admin/users');
      expect(res.status).toBe(403);
    });

    test('GET /api/admin/users - with admin token', async () => {
      const res = await request(app).get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/admin/stats', async () => {
      const res = await request(app).get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalUsers');
      expect(res.body).toHaveProperty('usersByPlan');
    });

    test('PATCH /api/admin/users/:id/plan', async () => {
      const user = createTestUser({ email: `plan_${Date.now()}@test.com` });
      const res = await request(app).patch(`/api/admin/users/${user.id}/plan`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ plan: 'Pro' });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    test('PATCH /api/admin/users/:id/plan - invalid plan', async () => {
      const user = createTestUser({ email: `badplan_${Date.now()}@test.com` });
      const res = await request(app).patch(`/api/admin/users/${user.id}/plan`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ plan: 'Ultimate' });
      expect(res.status).toBe(400);
    });
  });
});
