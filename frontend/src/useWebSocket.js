import { useEffect, useRef, useState, useCallback } from 'react';

export function useWebSocket() {
  const [prices, setPrices] = useState({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        console.log('[WS] Connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'snapshot') {
            setPrices(data.prices || {});
          } else if (data.type === 'price') {
            setPrices(prev => ({ ...prev, [data.symbol]: data }));
          }
        } catch (e) {  }
      };

      ws.onclose = () => {
        setConnected(false);
        console.log('[WS] Disconnected, reconnecting in 3s...');
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(connect, 3000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { prices, connected };
}
