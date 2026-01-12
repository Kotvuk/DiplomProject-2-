const { app, mockFetch, createTestUser } = require('./setup');
const request = require('supertest');

describe('AI routes', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({}), ok: true });
  });

  test('POST /api/ai/chat', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        choices: [{ message: { content: 'BTC looks bullish today' } }]
      })
    });
    var res = await request(app).post('/api/ai/chat').send({
      message: 'What is BTC doing?', history: []
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('reply');
  });

  test('POST /api/ai/analyze - basic', async () => {

    for (let i = 0; i < 6; i++) {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(
          Array.from({ length: 200 }, (_, j) => [Date.now(), '100', '110', '90', String(100 + j), '1000'])
        )
      });
    }

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        choices: [{ message: { content: '## Анализ\n**Общая уверенность**: 75%\n**Оценка монеты**: 7/10\nНаправление: LONG\nTake Profit: $52000\nStop Loss: $48000' } }]
      })
    });

    const res = await request(app).post('/api/ai/analyze').send({
      symbol: 'BTCUSDT', price: 50000, change24h: 2.5, high: 51000, low: 49000, volume: '1B'
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('analysis');
  });

  test('POST /api/ai/chat - error handling', async () => {
    mockFetch.mockRejectedValueOnce(new Error('API down'));
    const res = await request(app).post('/api/ai/chat').send({ message: 'test' });
    expect(res.status).toBe(500);
  });
});

describe('News routes', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test('GET /api/news', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ Data: [{ title: 'BTC news' }, { title: 'ETH news' }] })
    });
    const res = await request(app).get('/api/news');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  test('GET /api/news - error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'));
    var res = await request(app).get('/api/news');
    expect(res.status).toBe(500);
  });

  test('POST /api/news/summary', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        choices: [{ message: { content: 'BTC reached new highs. Bullish sentiment prevails.' } }]
      })
    });
    const res = await request(app).post('/api/news/summary').send({
      title: 'BTC hits ATH', body: 'Bitcoin reached $100k today', lang: 'en'
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('summary');
  });
});

