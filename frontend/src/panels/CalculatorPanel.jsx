import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLang } from '../LangContext';
import { useTheme } from '../ThemeContext';

const cardAnim = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 } };

var getStyles = (theme) => ({
  card: { background: theme.cardBg, border: '1px solid ' + theme.border, borderRadius: 12, padding: 20, marginBottom: 16 },
  inputStyle: { width: '100%', background: theme.inputBg, border: '1px solid ' + theme.border, borderRadius: 8, padding: '10px 14px', color: theme.text, fontSize: 14, fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box' },
  resultCard: (color) => ({ background: theme.cardBg, border: '1px solid ' + theme.border, borderRadius: 12, padding: 20, marginBottom: 16, borderLeft: `3px solid ${color}`, textAlign: 'center' }),
});

function RiskGauge({ value, theme, t }) {

  const riskPct = Math.min(100, Math.max(0, value));
  var angle = (riskPct / 100) * 180;
  const getColor = (pct) => pct <= 25 ? theme.green : pct <= 50 ? theme.yellow : pct <= 75 ? '#f97316' : theme.red;
  const color = getColor(riskPct);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0' }}>
      <div style={{ position: 'relative', width: 180, height: 100 }}>
        <svg width="180" height="100" viewBox="0 0 180 100">
          {}
          <path d="M 10 90 A 80 80 0 0 1 170 90" fill="none" stroke={theme.border} strokeWidth="12" strokeLinecap="round" />
          {}
          <path d="M 10 90 A 80 80 0 0 1 170 90" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${(angle / 180) * 251.2} 251.2`}
            style={{ transition: 'all 0.5s ease' }} />
          {}
          <line x1="90" y1="90" x2={90 + 60 * Math.cos((Math.PI * (180 - angle)) / 180)} y2={90 - 60 * Math.sin((Math.PI * (180 - angle)) / 180)}
            stroke={color} strokeWidth="3" strokeLinecap="round" style={{ transition: 'all 0.5s ease' }} />
          <circle cx="90" cy="90" r="5" fill={color} style={{ transition: 'all 0.5s ease' }} />
        </svg>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color, marginTop: 8 }}>{riskPct.toFixed(0)}%</div>
      <div style={{ fontSize: 12, color: theme.textMuted }}>{t('riskMeter')}</div>
    </div>
  );
}

export default function CalculatorPanel() {
  const { t } = useLang();
  const { theme } = useTheme();

  var [deposit, setDeposit] = useState(() => { try { return JSON.parse(localStorage.getItem('calc_deposit')) || 10000; } catch { return 10000; } });
  const [riskPct, setRiskPct] = useState(() => { try { return JSON.parse(localStorage.getItem('calc_risk')) || 2; } catch { return 2; } });
  const [entryPrice, setEntryPrice] = useState(() => { try { return JSON.parse(localStorage.getItem('calc_entry')) || 95000; } catch { return 95000; } });
  const [stopLoss, setStopLoss] = useState(() => { try { return JSON.parse(localStorage.getItem('calc_sl')) || 93000; } catch { return 93000; } });
  const [takeProfit, setTakeProfit] = useState(() => { try { return JSON.parse(localStorage.getItem('calc_tp')) || 100000; } catch { return 100000; } });
  const [leverage, setLeverage] = useState(() => { try { return JSON.parse(localStorage.getItem('calc_leverage')) || 1; } catch { return 1; } });
  const [winRate, setWinRate] = useState(55);

  const styles = getStyles(theme);

  useEffect(() => { localStorage.setItem('calc_deposit', JSON.stringify(deposit)); }, [deposit]);
  useEffect(() => { localStorage.setItem('calc_risk', JSON.stringify(riskPct)); }, [riskPct]);
  useEffect(() => { localStorage.setItem('calc_entry', JSON.stringify(entryPrice)); }, [entryPrice]);
  useEffect(() => { localStorage.setItem('calc_sl', JSON.stringify(stopLoss)); }, [stopLoss]);
  useEffect(() => { localStorage.setItem('calc_tp', JSON.stringify(takeProfit)); }, [takeProfit]);
  useEffect(() => { localStorage.setItem('calc_leverage', JSON.stringify(leverage)); }, [leverage]);

  const calc = useMemo(() => {
    var riskAmount = deposit * (riskPct / 100);
    const slDistance = Math.abs(entryPrice - stopLoss);
    const tpDistance = Math.abs(takeProfit - entryPrice);
    if (slDistance === 0 || entryPrice === 0) return null;

    const coins = riskAmount / slDistance;
    const positionSize = coins * entryPrice;
    const margin = positionSize / leverage;
    const maxLoss = riskAmount;
    const potentialProfit = coins * tpDistance;
    const riskReward = tpDistance / slDistance;
    const commission = positionSize * 0.001;
    const liquidationPrice = entryPrice > stopLoss
      ? entryPrice * (1 - 1 / leverage * 0.95)
      : entryPrice * (1 + 1 / leverage * 0.95);
    const riskLevel = riskPct <= 1 ? 'low' : riskPct <= 3 ? 'medium' : riskPct <= 5 ? 'high' : 'veryHigh';

    const p = winRate / 100;
    const q = 1 - p;
    const b = riskReward;
    const kelly = b > 0 ? Math.max(0, (b * p - q) / b) : 0;
    const kellyPct = kelly * 100;

    const conservativeSize = deposit * 0.01 / slDistance * entryPrice;
    const moderateSize = deposit * 0.02 / slDistance * entryPrice;
    const aggressiveSize = deposit * 0.05 / slDistance * entryPrice;

    return { positionSize, coins, maxLoss, potentialProfit, riskReward, liquidationPrice, commission, riskLevel, margin, kellyPct, kelly, conservativeSize, moderateSize, aggressiveSize };
  }, [deposit, riskPct, entryPrice, stopLoss, takeProfit, leverage, winRate]);

  const riskColors = { low: '#22c55e', medium: '#eab308', high: '#f97316', veryHigh: '#ef4444' };

  return (
    <div>
      <h2 style={{ color: theme.text, fontSize: 20, marginBottom: 16 }}>🧮 {t('calculatorTitle')}</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {}
        <motion.div style={styles.card} {...cardAnim}>
          <div style={{ display: 'grid', gap: 14 }}>
            {[
              { label: t('deposit') + ' ($)', value: deposit, set: setDeposit },
              { label: t('riskPercent'), value: riskPct, set: setRiskPct, step: 0.5 },
              { label: t('entryPrice') + ' ($)', value: entryPrice, set: setEntryPrice },
              { label: t('stopLoss') + ' ($)', value: stopLoss, set: setStopLoss },
              { label: t('takeProfit') + ' ($)', value: takeProfit, set: setTakeProfit },
              { label: t('leverage') + ' x', value: leverage, set: setLeverage, min: 1, max: 125 },
              { label: t('winRatePercent'), value: winRate, set: setWinRate, min: 1, max: 99 },
            ].map((f, i) => (
              <div key={i}>
                <label style={{ color: theme.textMuted, fontSize: 12, marginBottom: 4, display: 'block' }}>{f.label}</label>
                <input style={styles.inputStyle} type="number" value={f.value} onChange={e => f.set(+e.target.value)} step={f.step || 'any'} min={f.min} max={f.max} />
              </div>
            ))}
          </div>

          {}
          {calc && (
            <div style={{ marginTop: 20 }}>
              <label style={{ color: theme.textMuted, fontSize: 12, marginBottom: 8, display: 'block' }}>{t('riskScale')}</label>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {['low', 'medium', 'high', 'veryHigh'].map(level => (
                  <motion.div key={level} style={{
                    flex: 1, height: 8, borderRadius: 4,
                    background: calc.riskLevel === level ? riskColors[level] : theme.border,
                  }} animate={{ background: calc.riskLevel === level ? riskColors[level] : theme.border }}
                    transition={{ duration: 0.3 }} />
                ))}
              </div>
              <div style={{ textAlign: 'center', color: riskColors[calc.riskLevel], fontWeight: 600, fontSize: 14 }}>
                {t(calc.riskLevel)}
              </div>
            </div>
          )}
        </motion.div>

        {}
        <div>
          {calc ? (
            <>
              {}
              <motion.div style={styles.card} {...cardAnim} transition={{ delay: 0.1 }}>
                <RiskGauge value={riskPct * 10} theme={theme} t={t} />
              </motion.div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: t('positionSize'), value: '$' + calc.positionSize.toFixed(2), color: theme.accent },
                  { label: t('coins'), value: calc.coins.toFixed(6), color: '#8b5cf6' },
                  { label: t('maxLoss'), value: '-$' + calc.maxLoss.toFixed(2), color: theme.red },
                  { label: t('potentialProfit'), value: '+$' + calc.potentialProfit.toFixed(2), color: theme.green },
                  { label: t('riskReward'), value: '1:' + calc.riskReward.toFixed(2), color: theme.yellow },
                  { label: t('liquidationPrice'), value: '$' + calc.liquidationPrice.toFixed(2), color: '#f97316' },
                ].map((item, i) => (
                  <motion.div key={i} style={styles.resultCard(item.color)}
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i, duration: 0.25 }}>
                    <div style={{ fontSize: 12, color: theme.textMuted }}>{item.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.value}</div>
                  </motion.div>
                ))}

                {}
                <motion.div style={{ ...styles.resultCard(theme.accent), gridColumn: 'span 2' }}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <div style={{ fontSize: 12, color: theme.textMuted }}>{t('kellyCriterion')}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: theme.accent }}>{calc.kellyPct.toFixed(1)}%</div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
                    {t('kellyOptimalBet')}: ${(deposit * calc.kelly).toFixed(2)}
                  </div>
                </motion.div>

                {}
                <motion.div style={{ ...styles.resultCard(theme.textMuted), gridColumn: 'span 2' }}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                  <div style={{ fontSize: 12, color: theme.textMuted }}>{t('commission')}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: theme.textMuted }}>${calc.commission.toFixed(2)}</div>
                </motion.div>
              </div>

              {}
              <motion.div style={{ ...styles.card, marginTop: 12 }}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <h3 style={{ color: theme.text, fontSize: 15, marginBottom: 12 }}>📊 {t('positionSizingRec')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  {[
                    { label: t('conservative') + ' (1%)', value: calc.conservativeSize, color: theme.green },
                    { label: t('moderate') + ' (2%)', value: calc.moderateSize, color: theme.yellow },
                    { label: t('aggressive') + ' (5%)', value: calc.aggressiveSize, color: theme.red },
                  ].map((rec, i) => (
                    <div key={i} style={{ textAlign: 'center', padding: 12, background: theme.inputBg, borderRadius: 8, border: '1px solid ' + theme.border }}>
                      <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>{rec.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: rec.color }}>${rec.value.toFixed(0)}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </>
          ) : (
            <div style={{ ...styles.card, textAlign: 'center', color: theme.textSecondary, padding: 40 }}>
              {t('loading')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
