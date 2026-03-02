import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLang } from '../LangContext';
import { useTheme } from '../ThemeContext';
import { useWebSocket } from '../useWebSocket';
import ExportButtons from './ExportButtons';

const getStyles = (theme) => ({
  card: { background: theme.cardBg, border: '1px solid ' + theme.border, borderRadius: 12, padding: 20, marginBottom: 16 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 },
  statVal: { fontSize: 28, fontWeight: 700, color: theme.text },
  statLabel: { fontSize: 13, color: theme.textMuted, marginTop: 4 },
});

function fngColor(v) { return v <= 25 ? '#ef4444' : v <= 45 ? '#f97316' : v <= 55 ? '#eab308' : v <= 75 ? '#84cc16' : '#22c55e'; }
function fngLabelKey(v) { return v <= 25 ? 'extremeFear' : v <= 45 ? 'fear' : v <= 55 ? 'neutral' : v <= 75 ? 'greed' : 'extremeGreed'; }

export default function DashboardPanel() {
  const { t } = useLang();
  const { theme } = useTheme();
  const [rec, setRec] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const { prices: wsPrices, connected: wsConnected } = useWebSocket();

  const styles = getStyles(theme);

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/dashboard/recommendation').then(r => r.json())
    ]).then(([d, r]) => {
      setData(d);
      setRec(r.recommendation || '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: theme.textMuted, textAlign: 'center', padding: 40 }}>{t('loading')}</div>;
  if (!data) return <div style={{ color: theme.textMuted, textAlign: 'center', padding: 40 }}>Error loading dashboard</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <h2 style={{ color: theme.text, fontSize: 20, margin: 0 }}>{t('dashboard')}</h2>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: wsConnected ? '#22c55e22' : '#ef444422', color: wsConnected ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
          {wsConnected ? '● LIVE' : '○ OFFLINE'}
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <ExportButtons type="analytics" />
        </div>
      </div>

      {}
      {Object.keys(wsPrices).length > 0 && (
        <motion.div style={{ ...styles.card, padding: 12, overflow: 'hidden' }} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 4 }}>
            {Object.values(wsPrices).filter(p => p && p.symbol).slice(0, 10).map(p => (
              <div key={p.symbol} style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, minWidth: 140 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: theme.text }}>{p.symbol?.replace('USDT', '')}</span>
                <span style={{ fontSize: 13, color: theme.text, fontWeight: 500 }}>${parseFloat(p.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: parseFloat(p.change) >= 0 ? '#22c55e' : '#ef4444' }}>
                  {parseFloat(p.change) >= 0 ? '+' : ''}{p.change}%
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {}
      {rec && (
        <div style={{ ...styles.card, background: 'linear-gradient(135deg, ' + theme.accent + '26, ' + theme.accent + '1A)', borderColor: theme.accent + '4D' }}>
          <div style={{ fontSize: 13, color: theme.accent, marginBottom: 6, fontWeight: 600 }}>{t('aiRecommendation')}</div>
          <div style={{ fontSize: 16, color: theme.text, fontWeight: 500 }}>{rec}</div>
        </div>
      )}

      {}
      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.statLabel}>{t('totalPnl')}</div>
          <div style={{ ...styles.statVal, color: data.totalPnl >= 0 ? theme.green : theme.red }}>
            ${data.totalPnl?.toFixed(2) || '0.00'}
          </div>
        </div>
        <div style={styles.card}>
          <div style={styles.statLabel}>{t('signalAccuracy')}</div>
          <div style={styles.statVal}>{data.signalAccuracy?.toFixed(1) || '0'}%</div>
          <div style={{ fontSize: 12, color: theme.textMuted }}>{data.totalSignals || 0} {t('totalSignalsLabel')}</div>
        </div>
        <div style={styles.card}>
          <div style={styles.statLabel}>{t('fearGreed')}</div>
          {data.fngValue ? (
            <>
              <div style={{ ...styles.statVal, color: fngColor(+data.fngValue) }}>{data.fngValue}</div>
              <div style={{ fontSize: 14, color: fngColor(+data.fngValue), fontWeight: 600 }}>{t(fngLabelKey(+data.fngValue))}</div>
            </>
          ) : <div style={{ color: theme.textMuted }}>N/A</div>}
        </div>
        <div style={styles.card}>
          <div style={styles.statLabel}>{t('topMover')}</div>
          {data.topMover ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 700, color: theme.text }}>{data.topMover.symbol.replace('USDT', '')}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: data.topMover.change >= 0 ? theme.green : theme.red }}>
                {data.topMover.change >= 0 ? '+' : ''}{data.topMover.change.toFixed(2)}%
              </div>
            </>
          ) : <div style={{ color: theme.textMuted }}>N/A</div>}
        </div>
      </div>

      {}
      <div style={styles.card}>
        <h3 style={{ color: theme.text, fontSize: 16, marginBottom: 12 }}>{t('bestSignalToday')}</h3>
        {data.bestSignal ? (
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 18, color: theme.text }}>{data.bestSignal.pair?.replace('USDT', '')}/USDT</span>
            <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: data.bestSignal.direction === 'LONG' ? theme.greenBg : theme.redBg, color: data.bestSignal.direction === 'LONG' ? theme.green : theme.red }}>
              {data.bestSignal.direction}
            </span>
            <span style={{ color: theme.textSecondary }}>@ ${data.bestSignal.entry_price}</span>
            <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: theme.greenBg, color: theme.green }}>✅ TP Hit</span>
          </div>
        ) : (
          <div style={{ color: theme.textSecondary, textAlign: 'center', padding: 10 }}>{t('noBestSignal')}</div>
        )}
      </div>
    </div>
  );
}
