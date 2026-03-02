import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '../LangContext';
import { useTheme } from '../ThemeContext';

const STABLECOINS = [
  'USDTUSDT', 'USDCUSDT', 'BUSDUSDT', 'DAIUSDT', 'TUSDUSDT', 'USDPUSDT',
  'GUSDUSDT', 'FDUSDUSDT', 'PYUSDUSDT', 'USDEUSDT', 'FRAXUSDT',
  'USTUSDT', 'EURUSDT', 'GBPUSDT', 'AUDUSDT', 'TRYUSDT',
  'BRLUSDT', 'AEURUSDT', 'BIDRBUSD', 'USDSBUSDT',
];

function changeColor(pct) {
  if (pct < -5) return '#7f1d1d';
  if (pct < -2) return '#dc2626';
  if (pct < -0.5) return '#ea580c';
  if (pct <= 0.5) return '#52525b';
  if (pct <= 2) return '#65a30d';
  if (pct <= 5) return '#16a34a';
  return '#15803d';
}

export default function HeatmapPanel() {
  const { t } = useLang();
  const { theme } = useTheme();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const card = { background: theme.cardBg, border: '1px solid ' + theme.border, borderRadius: 12, padding: 20, marginBottom: 16 };

  const fetchData = useCallback(() => {
    fetch('/api/heatmap').then(r => r.json()).then(d => {
      const filtered = (Array.isArray(d) ? d : [])
        .filter(tk => !STABLECOINS.includes(tk.symbol))
        .sort((a, b) => (+b.quoteVolume || 0) - (+a.quoteVolume || 0));
      setData(filtered);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 15000);
    return () => clearInterval(iv);
  }, [fetchData]);

  if (loading) return <div style={{ color: theme.textMuted, textAlign: 'center', padding: 40 }}>{t('loading')}</div>;

  const maxVol = Math.max(...data.map(d => +d.quoteVolume || 0), 1);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <h2 style={{ color: theme.text, fontSize: 20, margin: 0 }}>{t('heatmapTitle')}</h2>
      </div>

      <motion.div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 20px' }}
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <span style={{ color: theme.textMuted, fontSize: 13 }}>{t('heatmapLegend')}:</span>
        {[[-6, '<-5%'], [-3, '-2…-5%'], [-1, '-0.5…-2%'], [0, '±0.5%'], [1, '+0.5…+2%'], [3, '+2…+5%'], [6, '>+5%']].map(([v, label]) => (
          <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 16, height: 16, borderRadius: 3, background: changeColor(v) }} />
            <span style={{ color: theme.textSecondary, fontSize: 11 }}>{label}</span>
          </div>
        ))}
      </motion.div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {data.map((tk, i) => {
          const pct = +tk.priceChangePercent;
          const vol = +tk.quoteVolume || 0;
          const sizeRatio = Math.max(0.4, Math.min(1, vol / maxVol));
          const baseSize = 80 + sizeRatio * 100;
          return (
            <motion.div
              key={tk.symbol}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.02, duration: 0.2 }}
              whileHover={{ scale: 1.05, zIndex: 5 }}
              onClick={() => setSelected(selected?.symbol === tk.symbol ? null : tk)}
              style={{
                width: baseSize, height: baseSize * 0.7,
                background: changeColor(pct), borderRadius: 8, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                border: selected?.symbol === tk.symbol ? '2px solid ' + theme.accent : '2px solid transparent',
                transition: 'border 0.15s',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: baseSize > 140 ? 15 : 12, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                {tk.symbol.replace('USDT', '')}
              </div>
              <div style={{ fontSize: baseSize > 140 ? 13 : 10, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
              </div>
              {baseSize > 130 && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                  ${(+tk.lastPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div style={{ ...card, marginTop: 16 }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
            <h3 style={{ color: theme.text, fontSize: 16, marginBottom: 12 }}>
              {selected.symbol.replace('USDT', '')}/USDT
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              {[
                [t('price'), '$' + (+selected.lastPrice).toLocaleString(undefined, { maximumFractionDigits: 4 }), theme.text],
                [t('change24h'), (+selected.priceChangePercent >= 0 ? '+' : '') + (+selected.priceChangePercent).toFixed(2) + '%', +selected.priceChangePercent >= 0 ? theme.green : theme.red],
                [t('high24h'), '$' + (+selected.highPrice).toLocaleString(undefined, { maximumFractionDigits: 4 }), theme.text],
                [t('low24h'), '$' + (+selected.lowPrice).toLocaleString(undefined, { maximumFractionDigits: 4 }), theme.text],
                [t('volumeLabel'), '$' + (+selected.quoteVolume / 1e6).toFixed(1) + 'M', theme.text],
              ].map(([label, val, color]) => (
                <div key={label}>
                  <div style={{ color: theme.textMuted, fontSize: 12 }}>{label}</div>
                  <div style={{ color, fontSize: 16, fontWeight: 700 }}>{val}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
