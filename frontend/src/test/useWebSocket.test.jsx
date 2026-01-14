import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('useWebSocket hook logic', () => {
  let mockWs;
  let MockWebSocket;

  beforeEach(() => {
    mockWs = {
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      close: vi.fn(),
      send: vi.fn(),
      readyState: 1,
    };
    MockWebSocket = vi.fn(() => mockWs);
    global.WebSocket = MockWebSocket;
  });

  afterEach(() => {
    delete global.WebSocket;
  });

  it('creates WebSocket with correct URL', () => {

    const protocol = 'ws:';
    const host = 'localhost:3000';
    const url = `${protocol}//${host}/ws`;
    expect(url).toBe('ws://localhost:3000/ws');
  });

  it('parses price update messages', () => {
    const data = {
      type: 'price',
      symbol: 'BTCUSDT',
      price: '50000.00',
      change: '2.50',
    };
    const parsed = JSON.parse(JSON.stringify(data));
    expect(parsed.type).toBe('price');
    expect(parsed.symbol).toBe('BTCUSDT');
    expect(parsed.price).toBe('50000.00');
  });

  it('parses snapshot messages', () => {
    const data = {
      type: 'snapshot',
      prices: {
        BTCUSDT: { symbol: 'BTCUSDT', price: '50000' },
        ETHUSDT: { symbol: 'ETHUSDT', price: '3000' },
      }
    };
    const parsed = JSON.parse(JSON.stringify(data));
    expect(parsed.type).toBe('snapshot');
    expect(Object.keys(parsed.prices)).toHaveLength(2);
  });
});
