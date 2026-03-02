// Единый список торговых пар, которые поддерживает платформа.
// Импортировать отсюда, а не дублировать в каждом роуте.

const ALLOWED_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'SOLUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT',
  'LINKUSDT', 'UNIUSDT', 'LTCUSDT', 'ATOMUSDT', 'NEARUSDT',
  'APTUSDT', 'ARBUSDT', 'OPUSDT', 'INJUSDT', 'SUIUSDT',
  'SEIUSDT', 'TIAUSDT', 'JUPUSDT', 'WLDUSDT', 'FTMUSDT',
  'AAVEUSDT', 'MKRUSDT', 'COMPUSDT', 'SNXUSDT', 'CRVUSDT',
  'LDOUSDT', 'STETHUSDT', 'RNDRUSDT', 'FETUSDT', 'AGIXUSDT',
  'OCEANUSDT', 'TAOUSDT', 'GRTUSDT', 'FLOWUSDT', 'IMXUSDT',
  'SANDUSDT', 'MANAUSDT', 'AXSUSDT', 'GALAUSDT',
];

// Set-версия для быстрых проверок (O(1) вместо includes)
const ALLOWED_SYMBOLS_SET = new Set(ALLOWED_SYMBOLS);

module.exports = { ALLOWED_SYMBOLS, ALLOWED_SYMBOLS_SET };
