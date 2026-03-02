const WebSocket = require('ws');

const BINANCE_WS = 'wss://stream.binance.com:9443/ws';

const DEFAULT_SYMBOLS = ['btcusdt', 'ethusdt', 'bnbusdt', 'xrpusdt', 'adausdt', 'solusdt', 'dogeusdt', 'dotusdt', 'avaxusdt'];

let wss = null;
let binanceWs = null;
let reconnectTimer = null;
const latestPrices = {};

function connectBinance() {
  const streams = DEFAULT_SYMBOLS.map(s => `${s}@miniTicker`).join('/');
  const url = `${BINANCE_WS}/${streams}`;

  try {
    binanceWs = new WebSocket(url);

    binanceWs.on('open', () => {
      console.log('[WS] Connected to Binance stream');
    });

    binanceWs.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.e === '24hrMiniTicker') {
          const priceUpdate = {
            type: 'price',
            symbol: msg.s,
            price: msg.c,
            open: msg.o,
            high: msg.h,
            low: msg.l,
            volume: msg.v,
            quoteVolume: msg.q,
            change: ((parseFloat(msg.c) - parseFloat(msg.o)) / parseFloat(msg.o) * 100).toFixed(2),
            timestamp: msg.E
          };

          latestPrices[msg.s] = priceUpdate;

          if (wss) {
            const payload = JSON.stringify(priceUpdate);
            wss.clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
              }
            });
          }
        }
      } catch (e) {  }
    });

    binanceWs.on('close', () => {
      console.log('[WS] Binance connection closed, reconnecting in 5s...');
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connectBinance, 5000);
    });

    binanceWs.on('error', (err) => {
      console.error('[WS] Binance error:', err.message);
      binanceWs.close();
    });
  } catch (e) {
    console.error('[WS] Failed to connect to Binance:', e.message);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectBinance, 5000);
  }
}

function setupWebSocket(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('[WS] Client connected');

    const snapshot = {
      type: 'snapshot',
      prices: latestPrices
    };
    ws.send(JSON.stringify(snapshot));

    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg.toString());

        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (e) {  }
    });

    ws.on('close', () => {
      console.log('[WS] Client disconnected');
    });
  });

  connectBinance();

  console.log('[WS] WebSocket server initialized');
}

module.exports = { setupWebSocket };
