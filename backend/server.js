const http = require('http');
const { app, initializeServices } = require('./app');
const { setupWebSocket } = require('./services/websocket');
const { checkAlerts } = require('./services/alertChecker');
const { checkTradeTPSL } = require('./services/tradeChecker');
const { checkPendingSignals } = require('./services/signalChecker');

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

setupWebSocket(server);

server.listen(PORT, async () => {
  console.log('Server started on port', PORT);
  console.log('WebSocket ready on ws://localhost:' + PORT);

  setInterval(() => { checkAlerts().catch(e => console.error('Alert check error:', e.message)); }, 30000);
  setInterval(() => { checkTradeTPSL().catch(e => console.error('Trade check error:', e.message)); }, 30000);
  setInterval(() => { checkPendingSignals().catch(e => console.error('Signal check error:', e.message)); }, 60000);

    try {
    await initializeServices();
  } catch (error) {
    console.error('Services init error:', error.message);
  }

  console.log('All services initialized');
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.close(() => {
    process.exit(0);
  });
});
