import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useLang } from '../LangContext';
import { useTheme } from '../ThemeContext';

const getStyles = (theme) => ({
  card: { background: theme.cardBg, border: '1px solid ' + theme.border, borderRadius: 12, padding: 20, marginBottom: 16 },
  selStyle: { background: theme.inputBg, color: theme.text, border: '1px solid ' + theme.border, borderRadius: 8, padding: '8px 14px', fontSize: 14, fontFamily: "'Inter',sans-serif", outline: 'none' }
});

const PAIRS = ['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','SOLUSDT'];

export default function WhalePanel() {
  const { t } = useLang();
  const { theme } = useTheme();

  const [pair, setPair] = useState(() => { try { return localStorage.getItem('whale_pair') || 'BTCUSDT'; } catch { return 'BTCUSDT'; } });
  const styles = getStyles(theme);
  useEffect(() => { localStorage.setItem('whale_pair', pair); }, [pair]);

  const [orderBook, setOrderBook] = useState(null);
  const [whaleTrades, setWhaleTrades] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [obR, trR] = await Promise.all([fetch(`/api/whale/orderbook?symbol=${pair}`), fetch(`/api/whale/trades?symbol=${pair}`)]);
      setOrderBook(await obR.json());
      setWhaleTrades(Array.isArray(await trR.clone().json()) ? await trR.json() : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [pair]);

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 15000); return () => clearInterval(iv); }, [fetchData]);

  const buyTotal = orderBook?.bids?.reduce((s, b) => s + (+b[0]) * (+b[1]), 0) || 0;
  const sellTotal = orderBook?.asks?.reduce((s, a) => s + (+a[0]) * (+a[1]), 0) || 0;
  const totalOB = buyTotal + sellTotal || 1;
  const buyPct = (buyTotal / totalOB * 100).toFixed(1);
  const sellPct = (sellTotal / totalOB * 100).toFixed(1);
  const topBids = orderBook?.bids?.slice(0, 10).map(b => ({ price: +b[0], qty: +b[1], usd: (+b[0]) * (+b[1]) })) || [];
  const topAsks = orderBook?.asks?.slice(0, 10).map(a => ({ price: +a[0], qty: +a[1], usd: (+a[0]) * (+a[1]) })) || [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <h2 style={{ color: theme.text, fontSize: 20, margin: 0 }}>🐋 {t('whaleTitle')}</h2>
        <select style={styles.selStyle} value={pair} onChange={e => setPair(e.target.value)}>
          {PAIRS.map(p => <option key={p} value={p}>{p.replace('USDT', '/USDT')}</option>)}
        </select>
        {loading && <span style={{ color: theme.accent, fontSize: 13 }}>⏳</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: t('buyVolume'), value: `$${(buyTotal / 1e6).toFixed(2)}M`, sub: `${buyPct}%`, color: theme.green },
          { label: t('sellVolume'), value: `$${(sellTotal / 1e6).toFixed(2)}M`, sub: `${sellPct}%`, color: theme.red },
          { label: t('ratio'), value: `${buyTotal > sellTotal ? '🟢' : '🔴'} ${(buyTotal / (sellTotal || 1)).toFixed(2)}`, color: buyTotal > sellTotal ? theme.green : theme.red },
          { label: t('largeTrades'), value: whaleTrades.length, sub: '> $100k', color: '#8b5cf6' },
        ].map((s, i) => (
          <motion.div key={i} style={styles.card} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <div style={{ fontSize: 12, color: theme.textMuted }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: 13, color: s.color }}>{s.sub}</div>}
          </motion.div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[{ title: '🟢 ' + t('buyWalls'), data: topBids, color: theme.green }, { title: '🔴 ' + t('sellWalls'), data: topAsks, color: theme.red }].map((section, si) => (
          <motion.div key={si} style={styles.card} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + si * 0.1 }}>
            <h3 style={{ color: section.color, fontSize: 15, marginBottom: 12 }}>{section.title}</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: theme.textMuted, fontSize: 11, borderBottom: '1px solid ' + theme.tableBorder }}>{t('price')}</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: theme.textMuted, fontSize: 11, borderBottom: '1px solid ' + theme.tableBorder }}>{t('amount')}</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: theme.textMuted, fontSize: 11, borderBottom: '1px solid ' + theme.tableBorder }}>{t('total')}</th>
                </tr>
              </thead>
              <tbody>
                {section.data.map((b, i) => (
                  <tr key={i}>
                    <td style={{ padding: '6px 8px', color: section.color, fontSize: 13 }}>${b.price.toLocaleString()}</td>
                    <td style={{ padding: '6px 8px', color: theme.textSecondary, fontSize: 13, textAlign: 'right' }}>{b.qty.toFixed(4)}</td>
                    <td style={{ padding: '6px 8px', color: theme.textMuted, fontSize: 13, textAlign: 'right' }}>${(b.usd / 1000).toFixed(1)}k</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        ))}
      </div>

      <motion.div style={styles.card} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h3 style={{ color: theme.text, fontSize: 15, marginBottom: 12 }}>🐋 {t('whaleFeed')}</h3>
        {whaleTrades.length === 0 ? (
          <div style={{ color: theme.textMuted, textAlign: 'center', padding: 20 }}>{t('noWhaleTrades')}</div>
        ) : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[t('side'), t('amount'), t('price'), t('total')].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: theme.textMuted, fontSize: 11, borderBottom: '1px solid ' + theme.tableBorder, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {whaleTrades.slice(0, 50).map((trade, i) => {
                  const isBuy = !trade.m;
                  return (
                    <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.5) }}
                      style={{ background: i % 2 === 0 ? 'transparent' : theme.tableRowAlt }}>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: isBuy ? theme.greenBg : theme.redBg, color: isBuy ? theme.green : theme.red }}>
                          {isBuy ? t('buy') : t('sell')}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', color: theme.textSecondary, fontSize: 13 }}>{(+trade.q).toFixed(4)}</td>
                      <td style={{ padding: '8px 10px', color: theme.textSecondary, fontSize: 13 }}>${(+trade.p).toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: isBuy ? theme.green : theme.red, fontSize: 13 }}>${(trade.usdValue / 1000).toFixed(1)}k</td>
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
