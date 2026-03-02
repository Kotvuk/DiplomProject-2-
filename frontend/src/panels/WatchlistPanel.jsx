import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useLang } from '../LangContext';
import { useTheme } from '../ThemeContext';

const POPULAR = ['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT','SOLUSDT','DOGEUSDT','DOTUSDT','AVAXUSDT','MATICUSDT','LINKUSDT','UNIUSDT','LTCUSDT','ATOMUSDT','NEARUSDT'];

export default function WatchlistPanel() {
  const { t } = useLang();
  const { theme } = useTheme();
  const [watchlist, setWatchlist] = useState([]);
  const [tickerData, setTickerData] = useState({});
  const [search, setSearch] = useState('');
  const [allPairs, setAllPairs] = useState(POPULAR);

  const card = { background: theme.cardBg, border: '1px solid ' + theme.border, borderRadius: 12, padding: 20, marginBottom: 16 };
  const inputStyle = { background: theme.inputBg, border: '1px solid ' + theme.border, borderRadius: 8, padding: '10px 14px', color: theme.text, fontSize: 14, fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box' };
  const btnDanger = { background: theme.redBg, color: theme.red, border: 'none', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: "'Inter',sans-serif" };

  const fetchWatchlist = useCallback(async () => {
    try { const r = await fetch('/api/watchlist'); setWatchlist(await r.json()); } catch (e) { console.error(e); }
  }, []);

  const fetchTickers = useCallback(async () => {
    if (watchlist.length === 0) { setTickerData({}); return; }
    try {
      const symbols = watchlist.map(w => w.pair);
      const promises = symbols.map(s => fetch(`/api/ticker24h/single?symbol=${s}`).then(r => r.json()));
      const results = await Promise.all(promises);
      const map = {};
      results.forEach(r => { if (r.symbol) map[r.symbol] = r; });
      setTickerData(map);
    } catch (e) { console.error(e); }
  }, [watchlist]);

  useEffect(() => {
    fetchWatchlist();
    fetch('/api/exchangeInfo').then(r => r.json()).then(d => { if (Array.isArray(d)) setAllPairs(d); }).catch(() => {});
  }, [fetchWatchlist]);

  useEffect(() => { fetchTickers(); const iv = setInterval(fetchTickers, 10000); return () => clearInterval(iv); }, [fetchTickers]);

  const handleAdd = async (pair) => {
    await fetch('/api/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pair }) });
    setSearch(''); fetchWatchlist();
  };

  const handleRemove = async (id) => {
    await fetch(`/api/watchlist/${id}`, { method: 'DELETE' }); fetchWatchlist();
  };

  const filtered = search.length >= 2
    ? allPairs.filter(p => p.toLowerCase().includes(search.toLowerCase()) && !watchlist.some(w => w.pair === p)).slice(0, 10)
    : [];

  const trendIndicator = (pct) => {
    const n = +pct;
    if (n > 5) return '🟢🟢🟢'; if (n > 2) return '🟢🟢'; if (n > 0) return '🟢';
    if (n > -2) return '🔴'; if (n > -5) return '🔴🔴'; return '🔴🔴🔴';
  };

  return (
    <div>
      <h2 style={{ color: theme.text, fontSize: 20, marginBottom: 16 }}>🏆 {t('watchlistTitle')}</h2>

      <motion.div style={{ ...card, display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <input style={{ ...inputStyle, width: '100%' }} value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} />
          {filtered.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: theme.cardBg, border: '1px solid ' + theme.border, borderRadius: '0 0 8px 8px', maxHeight: 200, overflowY: 'auto', zIndex: 10 }}>
              {filtered.map(p => (
                <div key={p} onClick={() => handleAdd(p)} style={{ padding: '8px 14px', cursor: 'pointer', color: theme.text, fontSize: 13, borderBottom: '1px solid ' + theme.border }}
                  onMouseEnter={e => e.target.style.background = theme.hoverBg}
                  onMouseLeave={e => e.target.style.background = 'transparent'}>
                  {p.replace('USDT', '/USDT')}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {POPULAR.slice(0, 6).filter(p => !watchlist.some(w => w.pair === p)).map(p => (
            <motion.button key={p} onClick={() => handleAdd(p)}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              style={{ background: theme.hoverBg, border: '1px solid ' + theme.border, borderRadius: 6, padding: '6px 12px', color: theme.textSecondary, fontSize: 12, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
              + {p.replace('USDT', '')}
            </motion.button>
          ))}
        </div>
      </motion.div>

      <motion.div style={card} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        {watchlist.length === 0 ? (
          <div style={{ color: theme.textMuted, textAlign: 'center', padding: 30 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
            {t('noWatchlistItems')}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{[t('pair'), t('price'), t('change'), t('high24h'), t('low24h'), t('volume'), 'Trend', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: theme.textMuted, fontSize: 11, borderBottom: '1px solid ' + theme.tableBorder, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {watchlist.map((w, i) => {
                  const tk = tickerData[w.pair];
                  const changePct = tk ? +tk.priceChangePercent : 0;
                  return (
                    <motion.tr key={w.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                      <td style={{ padding: '10px', fontWeight: 600, color: theme.text }}>{w.pair.replace('USDT', '')}<span style={{ color: theme.textMuted }}>/USDT</span></td>
                      <td style={{ padding: '10px', color: theme.text, fontWeight: 600 }}>{tk ? `$${(+tk.lastPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}` : '...'}</td>
                      <td style={{ padding: '10px' }}>
                        {tk && <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: changePct >= 0 ? theme.greenBg : theme.redBg, color: changePct >= 0 ? theme.green : theme.red }}>
                          {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                        </span>}
                      </td>
                      <td style={{ padding: '10px', color: theme.textSecondary, fontSize: 13 }}>{tk ? `$${(+tk.highPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}` : '...'}</td>
                      <td style={{ padding: '10px', color: theme.textSecondary, fontSize: 13 }}>{tk ? `$${(+tk.lowPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}` : '...'}</td>
                      <td style={{ padding: '10px', color: theme.textSecondary, fontSize: 13 }}>{tk ? (+tk.volume).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '...'}</td>
                      <td style={{ padding: '10px', fontSize: 14 }}>{tk ? trendIndicator(tk.priceChangePercent) : ''}</td>
                      <td style={{ padding: '10px' }}>
                        <motion.button style={btnDanger} onClick={() => handleRemove(w.id)}
                          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>{t('remove')}</motion.button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
