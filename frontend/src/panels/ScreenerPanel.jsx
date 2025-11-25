import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLang } from '../LangContext';
import { useTheme } from '../ThemeContext';

var getStyles = (theme) => ({
  card: { background: theme.cardBg, border: '1px solid ' + theme.border, borderRadius: 12, padding: 20, marginBottom: 16 },
  inputStyle: { background: theme.inputBg, border: '1px solid ' + theme.border, borderRadius: 8, padding: '8px 12px', color: theme.text, fontSize: 13, fontFamily: "'Inter',sans-serif", width: 120 },
  btnStyle: (active) => ({ background: active ? theme.accent + '33' : 'transparent', border: '1px solid ' + (active ? theme.accent : theme.border), borderRadius: 8, padding: '8px 16px', color: active ? theme.accent : theme.textSecondary, cursor: 'pointer', fontSize: 13, fontFamily: "'Inter',sans-serif", transition: 'all 0.15s' }),
  thStyle: (sortable) => ({
    textAlign: 'left', padding: '12px 16px', color: theme.textMuted, fontSize: 12, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid ' + theme.tableBorder,
    cursor: sortable ? 'pointer' : 'default', userSelect: 'none', transition: 'color 0.15s',
  }),
});

function Sparkline({ data, color, width = 80, height = 24 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ScreenerPanel() {
  const { t } = useLang();
  const { theme } = useTheme();
  const [data, setData] = useState([]);
  var [loading, setLoading] = useState(true);
  const [sparklines, setSparklines] = useState({});

  const [filters, setFilters] = useState(() => {
    try { return JSON.parse(localStorage.getItem('screener_filters')) || { minPrice: '', maxPrice: '', minChange: '', maxChange: '', sortBy: 'volume', sortDir: 'desc' }; }
    catch { return { minPrice: '', maxPrice: '', minChange: '', maxChange: '', sortBy: 'volume', sortDir: 'desc' }; }
  });
  const [preset, setPreset] = useState(() => {
    try { return localStorage.getItem('screener_preset') || 'all'; } catch { return 'all'; }
  });

  const styles = getStyles(theme);

  useEffect(() => { localStorage.setItem('screener_filters', JSON.stringify(filters)); }, [filters]);
  useEffect(() => { localStorage.setItem('screener_preset', preset); }, [preset]);

  const fetchData = useCallback(() => {
    fetch('/api/screener').then(r => r.json()).then(d => {
      setData(Array.isArray(d) ? d : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (data.length === 0) return;
    const sparks = {};
    data.forEach(tk => {
      const price = +tk.lastPrice;
      const change = +tk.priceChangePercent / 100;
      const startPrice = price / (1 + change);

      const pts = [];
      for (let i = 0; i < 12; i++) {
        var progress = i / 11;
        var noise = (Math.random() - 0.5) * Math.abs(price - startPrice) * 0.3;
        pts.push(startPrice + (price - startPrice) * progress + noise);
      }
      sparks[tk.symbol] = pts;
    });
    setSparklines(sparks);
  }, [data]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 15000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const applyPreset = (p) => {
    setPreset(p);
    if (p === 'gainers') setFilters(f => ({ ...f, minChange: '2', maxChange: '', sortBy: 'change', sortDir: 'desc' }));
    else if (p === 'losers') setFilters(f => ({ ...f, minChange: '', maxChange: '-2', sortBy: 'change', sortDir: 'asc' }));
    else if (p === 'volume') setFilters(f => ({ ...f, minChange: '', maxChange: '', sortBy: 'volume', sortDir: 'desc' }));
    else setFilters(f => ({ ...f, minPrice: '', maxPrice: '', minChange: '', maxChange: '', sortBy: 'volume', sortDir: 'desc' }));
  };

  const handleSort = (col) => {
    setFilters(f => ({
      ...f, sortBy: col,
      sortDir: f.sortBy === col ? (f.sortDir === 'desc' ? 'asc' : 'desc') : 'desc',
    }));
    setPreset('');
  };

  const sortArrow = (col) => {
    if (filters.sortBy !== col) return '';
    return filters.sortDir === 'desc' ? ' ↓' : ' ↑';
  };

  const filtered = useMemo(() => {
    let result = [...data];
    const { minPrice, maxPrice, minChange, maxChange, sortBy, sortDir } = filters;
    if (minPrice) result = result.filter(t => +t.lastPrice >= +minPrice);
    if (maxPrice) result = result.filter(t => +t.lastPrice <= +maxPrice);
    if (minChange) result = result.filter(t => +t.priceChangePercent >= +minChange);
    if (maxChange) result = result.filter(t => +t.priceChangePercent <= +maxChange);

    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortBy === 'price') result.sort((a, b) => dir * (+a.lastPrice - +b.lastPrice));
    else if (sortBy === 'change') result.sort((a, b) => dir * (+a.priceChangePercent - +b.priceChangePercent));
    else if (sortBy === 'pair') result.sort((a, b) => dir * a.symbol.localeCompare(b.symbol));
    else result.sort((a, b) => dir * (+a.quoteVolume - +b.quoteVolume));
    return result;
  }, [data, filters]);

  if (loading) return <div style={{ color: theme.textMuted, textAlign: 'center', padding: 40 }}>{t('loading')}</div>;

  const columns = [
    { key: 'pair', label: t('pair'), sortable: true },
    { key: 'price', label: t('price'), sortable: true },
    { key: 'change', label: t('change24h'), sortable: true },
    { key: 'chart', label: t('sparkline'), sortable: false },
    { key: 'high', label: t('high24h'), sortable: false },
    { key: 'low', label: t('low24h'), sortable: false },
    { key: 'volume', label: t('volumeLabel'), sortable: true },
  ];

  return (
    <div>
      <h2 style={{ color: theme.text, fontSize: 20, marginBottom: 16 }}>🔍 {t('screenerTitle')}</h2>

      {}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { id: 'all', icon: '', label: t('allPairs') },
          { id: 'gainers', icon: '🚀', label: t('topGainers') },
          { id: 'losers', icon: '📉', label: t('topLosers') },
          { id: 'volume', icon: '📊', label: t('highVolume') },
        ].map(p => (
          <motion.button key={p.id} style={styles.btnStyle(preset === p.id)} onClick={() => applyPreset(p.id)}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            {p.icon} {p.label}
          </motion.button>
        ))}
      </div>

      {}
      <motion.div style={{ ...styles.card, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '12px 20px' }}
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <span style={{ color: theme.textMuted, fontSize: 13 }}>{t('filters')}:</span>
        <input style={styles.inputStyle} type="number" placeholder={t('minPrice')} value={filters.minPrice} onChange={e => { setFilters(f => ({ ...f, minPrice: e.target.value })); setPreset(''); }} />
        <input style={styles.inputStyle} type="number" placeholder={t('maxPrice')} value={filters.maxPrice} onChange={e => { setFilters(f => ({ ...f, maxPrice: e.target.value })); setPreset(''); }} />
        <input style={styles.inputStyle} type="number" placeholder={t('minChange')} value={filters.minChange} onChange={e => { setFilters(f => ({ ...f, minChange: e.target.value })); setPreset(''); }} />
        <input style={styles.inputStyle} type="number" placeholder={t('maxChange')} value={filters.maxChange} onChange={e => { setFilters(f => ({ ...f, maxChange: e.target.value })); setPreset(''); }} />
        <motion.button style={{ ...styles.btnStyle(false), fontSize: 12 }} onClick={() => applyPreset('all')}
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>{t('resetFilters')}</motion.button>
      </motion.div>

      {}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: t('topGainers'), value: data.filter(t => +t.priceChangePercent > 0).length, color: theme.green },
          { label: t('topLosers'), value: data.filter(t => +t.priceChangePercent < 0).length, color: theme.red },
          { label: t('total'), value: data.length, color: theme.accent },
        ].map((stat, i) => (
          <motion.div key={i} style={{ ...styles.card, textAlign: 'center', marginBottom: 0 }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: theme.textMuted }}>{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {}
      {filtered.length === 0 ? (
        <div style={{ color: theme.textMuted, textAlign: 'center', padding: 40 }}>{t('noResults')}</div>
      ) : (
        <motion.div style={{ ...styles.card, padding: 0, overflow: 'auto' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key} style={styles.thStyle(col.sortable)}
                    onClick={() => col.sortable && handleSort(col.key)}>
                    {col.label}{col.sortable ? sortArrow(col.key) : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((tk, i) => {
                const pct = +tk.priceChangePercent;
                return (
                  <motion.tr key={tk.symbol}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.015, 0.5) }}
                    style={{ borderBottom: '1px solid ' + theme.tableBorder, background: i % 2 === 0 ? 'transparent' : theme.tableRowAlt }}>
                    <td style={{ padding: '10px 16px', color: theme.text, fontWeight: 600, fontSize: 14 }}>{tk.symbol.replace('USDT', '')}/USDT</td>
                    <td style={{ padding: '10px 16px', color: theme.text, fontSize: 14 }}>${(+tk.lastPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td style={{ padding: '10px 16px', color: pct >= 0 ? theme.green : theme.red, fontWeight: 600, fontSize: 14 }}>{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</td>
                    <td style={{ padding: '10px 16px' }}>
                      <Sparkline data={sparklines[tk.symbol]} color={pct >= 0 ? theme.green : theme.red} />
                    </td>
                    <td style={{ padding: '10px 16px', color: theme.textSecondary, fontSize: 13 }}>${(+tk.highPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td style={{ padding: '10px 16px', color: theme.textSecondary, fontSize: 13 }}>${(+tk.lowPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td style={{ padding: '10px 16px', color: theme.textSecondary, fontSize: 13 }}>${(+tk.quoteVolume / 1e6).toFixed(1)}M</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  );
}
