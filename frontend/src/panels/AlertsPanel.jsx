import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useLang } from '../LangContext';
import { useTheme } from '../ThemeContext';

const getStyles = (theme) => ({
  card: { background: theme.cardBg, border: '1px solid ' + theme.border, borderRadius: 12, padding: 20, marginBottom: 16 },
  inputStyle: { width: '100%', background: theme.inputBg, border: '1px solid ' + theme.border, borderRadius: 8, padding: '10px 14px', color: theme.text, fontSize: 14, fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box' },
  selStyle: { width: '100%', background: theme.inputBg, border: '1px solid ' + theme.border, borderRadius: 8, padding: '10px 14px', color: theme.text, fontSize: 14, fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box' },
  btnPrimary: { background: theme.accent, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: "'Inter',sans-serif" },
  btnDanger: { background: theme.redBg, color: theme.red, border: 'none', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: "'Inter',sans-serif" }
});

const PAIRS = ['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT','SOLUSDT','DOGEUSDT','DOTUSDT','AVAXUSDT'];

const beep = () => {
  try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(); o.connect(ctx.destination); o.frequency.value = 800; o.start(); setTimeout(() => o.stop(), 200); } catch {}
};

export default function AlertsPanel() {
  const { t } = useLang();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [pair, setPair] = useState('BTCUSDT');
  const [condition, setCondition] = useState('above');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [triggeredAlerts, setTriggeredAlerts] = useState([]);
  const knownTriggered = useRef(new Set());

  const fetchAlerts = useCallback(async () => {
    try {
      const [aR, tR] = await Promise.all([fetch('/api/alerts?status=active'), fetch('/api/alerts?status=triggered')]);
      setActiveAlerts(await aR.json());
      const triggered = await tR.json();
      for (const alert of triggered) {
        if (!knownTriggered.current.has(alert.id)) {
          knownTriggered.current.add(alert.id);
          if (triggeredAlerts.length > 0) beep();
        }
      }
      setTriggeredAlerts(triggered);
    } catch (e) { console.error(e); }
  }, [triggeredAlerts.length]);

  useEffect(() => { fetchAlerts(); const iv = setInterval(fetchAlerts, 10000); return () => clearInterval(iv); }, []);

  const handleCreate = async () => {
    if (!value) return;
    await fetch('/api/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pair, condition, value: +value, message }) });
    setValue(''); setMessage('');
    fetchAlerts();
  };

  const handleDelete = async (id) => {
    await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
    fetchAlerts();
  };

  const conditionLabels = { above: t('above'), below: t('below'), cross_above: t('crossAbove'), cross_below: t('crossBelow') };

  return (
    <div>
      <h2 style={{ color: theme.text, fontSize: 20, marginBottom: 16 }}>🔔 {t('alertsTitle')}</h2>

      <motion.div style={styles.card} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h3 style={{ color: theme.text, fontSize: 16, marginBottom: 16 }}>➕ {t('createAlert')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ color: theme.textMuted, fontSize: 12, marginBottom: 4, display: 'block' }}>{t('pair')}</label>
            <select style={styles.selStyle} value={pair} onChange={e => setPair(e.target.value)}>
              {PAIRS.map(p => <option key={p} value={p}>{p.replace('USDT', '/USDT')}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: theme.textMuted, fontSize: 12, marginBottom: 4, display: 'block' }}>{t('condition')}</label>
            <select style={styles.selStyle} value={condition} onChange={e => setCondition(e.target.value)}>
              {Object.entries(conditionLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: theme.textMuted, fontSize: 12, marginBottom: 4, display: 'block' }}>{t('price')} ($)</label>
            <input style={styles.inputStyle} type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="100000" />
          </div>
          <div>
            <label style={{ color: theme.textMuted, fontSize: 12, marginBottom: 4, display: 'block' }}>{t('alertMessage')}</label>
            <input style={styles.inputStyle} value={message} onChange={e => setMessage(e.target.value)} placeholder={t('alertMessage')} />
          </div>
        </div>
        <motion.button style={{ ...styles.btnPrimary, marginTop: 16 }} onClick={handleCreate}
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>{t('createAlert')}</motion.button>
      </motion.div>

      <motion.div style={styles.card} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <h3 style={{ color: theme.text, fontSize: 16, marginBottom: 12 }}>🟢 {t('activeAlerts')} ({activeAlerts.length})</h3>
        {activeAlerts.length === 0 ? (
          <div style={{ color: theme.textMuted, textAlign: 'center', padding: 20 }}>{t('noActiveAlerts')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{[t('pair'), t('condition'), t('price'), t('alertMessage'), ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: theme.textMuted, fontSize: 11, borderBottom: '1px solid ' + theme.tableBorder, textTransform: 'uppercase' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {activeAlerts.map(alert => (
                  <tr key={alert.id}>
                    <td style={{ padding: '10px', fontWeight: 600, color: theme.text }}>{alert.pair.replace('USDT', '')}<span style={{ color: theme.textMuted }}>/USDT</span></td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: theme.blueBg, color: theme.accent }}>
                        {conditionLabels[alert.condition] || alert.condition}
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: theme.text, fontWeight: 600 }}>${alert.value.toLocaleString()}</td>
                    <td style={{ padding: '10px', color: theme.textSecondary, fontSize: 13 }}>{alert.message || '—'}</td>
                    <td style={{ padding: '10px' }}>
                      <motion.button style={styles.btnDanger} onClick={() => handleDelete(alert.id)}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>{t('delete')}</motion.button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <motion.div style={styles.card} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h3 style={{ color: theme.yellow, fontSize: 16, marginBottom: 12 }}>⚡ {t('triggeredAlerts')} ({triggeredAlerts.length})</h3>
        {triggeredAlerts.length === 0 ? (
          <div style={{ color: theme.textMuted, textAlign: 'center', padding: 20 }}>{t('noTriggeredAlerts')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{[t('pair'), t('condition'), t('price'), t('alertMessage'), t('triggeredAt')].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: theme.textMuted, fontSize: 11, borderBottom: '1px solid ' + theme.tableBorder, textTransform: 'uppercase' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {triggeredAlerts.slice(0, 20).map(alert => (
                  <tr key={alert.id}>
                    <td style={{ padding: '10px', fontWeight: 600, color: theme.text }}>{alert.pair.replace('USDT', '')}<span style={{ color: theme.textMuted }}>/USDT</span></td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: theme.yellowBg, color: theme.yellow }}>
                        {conditionLabels[alert.condition] || alert.condition}
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: theme.text, fontWeight: 600 }}>${alert.value.toLocaleString()}</td>
                    <td style={{ padding: '10px', color: theme.textSecondary, fontSize: 13 }}>{alert.message || '—'}</td>
                    <td style={{ padding: '10px', color: theme.textSecondary, fontSize: 12 }}>{alert.triggered_at || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
