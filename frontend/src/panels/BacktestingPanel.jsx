import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../ThemeContext';
import { useLang } from '../LangContext';
import { useAuth } from '../AuthContext';

const icons = {
  chart: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>,
  run: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  settings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  history: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  ai: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
};

var STRATEGIES = [
  { id: 'ema_cross', name: 'EMA Crossover', desc: 'EMA9 пересекает EMA21' },
  { id: 'rsi_reversal', name: 'RSI Reversal', desc: 'Выход из зон перекупленности/перепроданности' },
  { id: 'macd_signal', name: 'MACD Signal', desc: 'Пересечение MACD и сигнальной линии' },
  { id: 'bollinger_breakout', name: 'Bollinger Breakout', desc: 'Пробой полос Боллинджера' },
  { id: 'support_resistance', name: 'Support/Resistance', desc: 'Отскок от уровней поддержки/сопротивления' },
];

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT'];
const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'];

export default function BacktestingPanel() {
  const { theme } = useTheme();
  const { t } = useLang();
  const { authFetch } = useAuth();

  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState('1h');
  const [strategy, setStrategy] = useState('ema_cross');
  const [days, setDays] = useState(90);
  const [capital, setCapital] = useState(5000);
  const [leverage, setLeverage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);

  const styles = getStyles(theme);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await authFetch('/api/backtest/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error('Error loading history:', e);
    }
  };

  const runBacktest = async (withAI = false) => {
    setLoading(true);
    setResult(null);
    setAiAnalysis(null);

    try {
      const endpoint = withAI ? '/api/backtest/run-with-analysis' : '/api/backtest/run';
      const res = await authFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          interval,
          days: parseInt(days),
          strategy,
          capital: parseFloat(capital),
          leverage: parseFloat(leverage)
        })
      });

      const data = await res.json();

      if (res.ok) {
        setResult(data);
        if (data.aiAnalysis) {
          setAiAnalysis(data.aiAnalysis);
        }
        loadHistory();
      } else {
        alert(data.error || 'Error running backtest');
      }
    } catch (e) {
      console.error('Backtest error:', e);
      alert('Error running backtest');
    } finally {
      setLoading(false);
    }
  };

  const runQuickBacktest = async () => {
    setLoading(true);
    setResult(null);

    try {
      var res = await authFetch('/api/backtest/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });

      const data = await res.json();

      if (res.ok) {
        setResult({
          quickResults: true,
          symbol: data.symbol,
          strategies: data.results,
          bestStrategy: data.bestStrategy
        });
      }
    } catch (e) {
      console.error('Quick backtest error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {}
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <span style={styles.icon}>{icons.chart}</span>
          <h2 style={styles.title}>Backtesting Engine</h2>
        </div>
        <div style={styles.headerActions}>
          <motion.button
            style={styles.historyBtn}
            onClick={() => setShowHistory(!showHistory)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {icons.history}
            <span>History</span>
          </motion.button>
        </div>
      </div>

      <div style={styles.grid}>
        {}
        <div style={styles.configPanel}>
          <h3 style={styles.sectionTitle}>⚙️ Configuration</h3>

          {}
          <div style={styles.field}>
            <label style={styles.label}>Symbol</label>
            <select
              style={styles.select}
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
            >
              {SYMBOLS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {}
          <div style={styles.field}>
            <label style={styles.label}>Strategy</label>
            <select
              style={styles.select}
              value={strategy}
              onChange={e => setStrategy(e.target.value)}
            >
              {STRATEGIES.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <p style={styles.hint}>{STRATEGIES.find(s => s.id === strategy)?.desc}</p>
          </div>

          {}
          <div style={styles.field}>
            <label style={styles.label}>Interval</label>
            <select
              style={styles.select}
              value={interval}
              onChange={e => setInterval(e.target.value)}
            >
              {INTERVALS.map(i => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>

          {}
          <div style={styles.field}>
            <label style={styles.label}>Period (days)</label>
            <input
              style={styles.input}
              type="number"
              value={days}
              onChange={e => setDays(e.target.value)}
              min={7}
              max={365}
            />
          </div>

          {}
          <div style={styles.field}>
            <label style={styles.label}>Initial Capital ($)</label>
            <input
              style={styles.input}
              type="number"
              value={capital}
              onChange={e => setCapital(e.target.value)}
              min={100}
            />
          </div>

          {}
          <div style={styles.field}>
            <label style={styles.label}>Leverage</label>
            <input
              style={styles.input}
              type="number"
              value={leverage}
              onChange={e => setLeverage(e.target.value)}
              min={1}
              max={10}
            />
          </div>

          {}
          <div style={styles.actions}>
            <motion.button
              style={styles.runBtn}
              onClick={() => runBacktest(false)}
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
            >
              {loading ? '⏳ Running...' : <>{icons.run} Run Backtest</>}
            </motion.button>

            <motion.button
              style={styles.aiBtn}
              onClick={() => runBacktest(true)}
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
            >
              {icons.ai} Run with AI Analysis
            </motion.button>

            <motion.button
              style={styles.quickBtn}
              onClick={runQuickBacktest}
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
            >
              ⚡ Quick Compare All
            </motion.button>
          </div>
        </div>

        {}
        <div style={styles.resultsPanel}>
          {result ? (
            result.quickResults ? (

              <QuickResults results={result} styles={styles} theme={theme} />
            ) : (

              <DetailedResults
                result={result}
                aiAnalysis={aiAnalysis}
                styles={styles}
                theme={theme}
              />
            )
          ) : (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>📊</span>
              <h3 style={styles.emptyTitle}>No Results Yet</h3>
              <p style={styles.emptyText}>
                Configure parameters and run a backtest to see results
              </p>
            </div>
          )}
        </div>
      </div>

      {}
      {showHistory && (
        <motion.div
          style={styles.historySidebar}
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 300, opacity: 0 }}
        >
          <h3 style={styles.historyTitle}>📜 History</h3>
          {history.length === 0 ? (
            <p style={styles.historyEmpty}>No history yet</p>
          ) : (
            history.map((item, i) => (
              <div key={item.id || i} style={styles.historyItem}>
                <div style={styles.historyHeader}>
                  <span style={styles.historySymbol}>{item.symbol}</span>
                  <span style={styles.historyStrategy}>{item.strategy_name}</span>
                </div>
                <div style={styles.historyMetrics}>
                  <span style={{ ...styles.historyMetric, color: theme.green }}>
                    ROI: {item.metrics?.roi?.toFixed(1) || 0}%
                  </span>
                  <span style={styles.historyMetric}>
                    Win: {item.metrics?.winRate?.toFixed(0) || 0}%
                  </span>
                </div>
                <span style={styles.historyDate}>
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </motion.div>
      )}
    </div>
  );
}

function QuickResults({ results, styles, theme }) {
  return (
    <div>
      <h3 style={styles.sectionTitle}>⚡ Quick Comparison: {results.symbol}</h3>
      <div style={styles.quickGrid}>
        {results.strategies.map((s, i) => (
          <motion.div
            key={s.strategy}
            style={{
              ...styles.quickCard,
              border: i === 0 ? `2px solid ${theme.green}` : styles.quickCard.border
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            {i === 0 && <span style={styles.bestBadge}>🏆 BEST</span>}
            <h4 style={styles.quickTitle}>{s.strategyName}</h4>
            <div style={styles.quickMetrics}>
              <div style={styles.quickMetric}>
                <span style={styles.quickMetricLabel}>ROI</span>
                <span style={{ ...styles.quickMetricValue, color: s.roi >= 0 ? theme.green : theme.red }}>
                  {s.roi.toFixed(1)}%
                </span>
              </div>
              <div style={styles.quickMetric}>
                <span style={styles.quickMetricLabel}>Win Rate</span>
                <span style={styles.quickMetricValue}>{s.winRate.toFixed(0)}%</span>
              </div>
              <div style={styles.quickMetric}>
                <span style={styles.quickMetricLabel}>Trades</span>
                <span style={styles.quickMetricValue}>{s.tradesCount}</span>
              </div>
              <div style={styles.quickMetric}>
                <span style={styles.quickMetricLabel}>Profit Factor</span>
                <span style={styles.quickMetricValue}>{s.profitFactor.toFixed(2)}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function DetailedResults({ result, aiAnalysis, styles, theme }) {
  const { metrics, trades, symbol, strategyName, days, capital } = result;

  return (
    <div>
      <h3 style={styles.sectionTitle}>
        📈 Results: {strategyName} on {symbol}
      </h3>

      {}
      <div style={styles.metricsGrid}>
        <MetricCard
          label="ROI"
          value={`${metrics.roi.toFixed(1)}%`}
          color={metrics.roi >= 0 ? theme.green : theme.red}
          theme={theme}
        />
        <MetricCard
          label="Win Rate"
          value={`${metrics.winRate.toFixed(1)}%`}
          theme={theme}
        />
        <MetricCard
          label="Profit Factor"
          value={metrics.profitFactor.toFixed(2)}
          theme={theme}
        />
        <MetricCard
          label="Max Drawdown"
          value={`${metrics.maxDrawdown.toFixed(1)}%`}
          color={theme.red}
          theme={theme}
        />
        <MetricCard
          label="Sharpe Ratio"
          value={metrics.sharpeRatio}
          theme={theme}
        />
        <MetricCard
          label="Total Trades"
          value={metrics.totalTrades}
          theme={theme}
        />
        <MetricCard
          label="Avg Win"
          value={`$${metrics.avgWin.toFixed(2)}`}
          color={theme.green}
          theme={theme}
        />
        <MetricCard
          label="Avg Loss"
          value={`$${metrics.avgLoss.toFixed(2)}`}
          color={theme.red}
          theme={theme}
        />
      </div>

      {}
      <div style={styles.chartArea}>
        <h4 style={styles.chartTitle}>Equity Curve</h4>
        <div style={styles.chartPlaceholder}>
          {metrics.returns && metrics.returns.length > 0 ? (
            <EquityChart returns={metrics.returns} theme={theme} />
          ) : (
            <span style={{ color: theme.textMuted }}>No equity data available</span>
          )}
        </div>
      </div>

      {}
      {trades && trades.length > 0 && (
        <div style={styles.tradesSection}>
          <h4 style={styles.chartTitle}>Recent Trades ({trades.length})</h4>
          <div style={styles.tradesTable}>
            <div style={styles.tradesHeader}>
              <span>Direction</span>
              <span>Entry</span>
              <span>Exit</span>
              <span>PnL</span>
              <span>Result</span>
            </div>
            {trades.slice(0, 10).map((trade, i) => (
              <div key={i} style={styles.tradesRow}>
                <span style={{
                  color: trade.direction === 'BUY' ? theme.green : theme.red
                }}>
                  {trade.direction}
                </span>
                <span>${trade.entryPrice?.toFixed(2)}</span>
                <span>${trade.exitPrice?.toFixed(2)}</span>
                <span style={{
                  color: trade.netPnl >= 0 ? theme.green : theme.red
                }}>
                  ${trade.netPnl?.toFixed(2)}
                </span>
                <span style={{
                  ...styles.badge,
                  background: trade.exitReason === 'Take Profit' ? theme.greenBg :
                    trade.exitReason === 'Stop Loss' ? theme.redBg : theme.badgeBg
                }}>
                  {trade.exitReason}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {}
      {aiAnalysis && (
        <div style={styles.aiSection}>
          <h4 style={styles.chartTitle}>🤖 AI Analysis</h4>
          <div style={styles.aiContent}>
            {aiAnalysis.split('\n').map((line, i) => (
              <p key={i} style={styles.aiLine}>{line}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color, theme }) {
  return (
    <div style={{
      background: theme.cardBg,
      borderRadius: 12,
      padding: '16px 20px',
      border: `1px solid ${theme.border}`
    }}>
      <span style={{ fontSize: 12, color: theme.textMuted, display: 'block' }}>{label}</span>
      <span style={{
        fontSize: 24,
        fontWeight: 700,
        color: color || theme.text,
        marginTop: 4
      }}>
        {value}
      </span>
    </div>
  );
}

function EquityChart({ returns, theme }) {
  const max = Math.max(...returns.map(Math.abs));
  const min = Math.min(...returns.map(Math.abs));
  var range = max - min || 1;

  const points = returns.map((r, i) => {
    const x = (i / (returns.length - 1)) * 100;
    const y = 100 - ((r - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="100%" height="150" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={theme.accent}
        strokeWidth="0.5"
      />
    </svg>
  );
}

function getStyles(theme) {
  return {
    container: {
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      position: 'relative'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    titleRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    },
    icon: {
      color: theme.accent
    },
    title: {
      fontSize: 24,
      fontWeight: 700,
      color: theme.text,
      margin: 0
    },
    headerActions: {
      display: 'flex',
      gap: 12
    },
    historyBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 16px',
      background: theme.cardBg,
      border: `1px solid ${theme.border}`,
      borderRadius: 10,
      color: theme.textSecondary,
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 500
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: '320px 1fr',
      gap: 24
    },
    configPanel: {
      background: theme.cardBg,
      borderRadius: 16,
      padding: 24,
      border: `1px solid ${theme.border}`
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 600,
      color: theme.text,
      marginBottom: 20
    },
    field: {
      marginBottom: 16
    },
    label: {
      display: 'block',
      fontSize: 13,
      fontWeight: 500,
      color: theme.textSecondary,
      marginBottom: 6
    },
    select: {
      width: '100%',
      padding: '12px 16px',
      background: theme.inputBg,
      border: `1px solid ${theme.border}`,
      borderRadius: 10,
      color: theme.text,
      fontSize: 14,
      cursor: 'pointer',
      outline: 'none'
    },
    input: {
      width: '100%',
      padding: '12px 16px',
      background: theme.inputBg,
      border: `1px solid ${theme.border}`,
      borderRadius: 10,
      color: theme.text,
      fontSize: 14,
      outline: 'none'
    },
    hint: {
      fontSize: 11,
      color: theme.textMuted,
      marginTop: 4,
      marginBottom: 0
    },
    actions: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      marginTop: 24
    },
    runBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: '14px 20px',
      background: theme.accent,
      border: 'none',
      borderRadius: 12,
      color: 'white',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer'
    },
    aiBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: '14px 20px',
      background: theme.purpleBg,
      border: `1px solid ${theme.purple}`,
      borderRadius: 12,
      color: theme.purple,
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer'
    },
    quickBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: '12px 16px',
      background: 'transparent',
      border: `1px solid ${theme.border}`,
      borderRadius: 12,
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: 500,
      cursor: 'pointer'
    },
    resultsPanel: {
      background: theme.cardBg,
      borderRadius: 16,
      padding: 24,
      border: `1px solid ${theme.border}`,
      minHeight: 400
    },
    emptyState: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: 300,
      textAlign: 'center'
    },
    emptyIcon: {
      fontSize: 48,
      marginBottom: 16
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: 600,
      color: theme.text,
      margin: '0 0 8px'
    },
    emptyText: {
      fontSize: 14,
      color: theme.textMuted,
      margin: 0
    },
    metricsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 12,
      marginBottom: 24
    },
    chartArea: {
      marginBottom: 24
    },
    chartTitle: {
      fontSize: 14,
      fontWeight: 600,
      color: theme.text,
      marginBottom: 12
    },
    chartPlaceholder: {
      background: theme.inputBg,
      borderRadius: 12,
      height: 150,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    tradesSection: {
      marginTop: 24
    },
    tradesTable: {
      background: theme.inputBg,
      borderRadius: 12,
      overflow: 'hidden'
    },
    tradesHeader: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
      padding: '12px 16px',
      background: theme.cardBg,
      fontSize: 12,
      fontWeight: 600,
      color: theme.textMuted,
      borderBottom: `1px solid ${theme.border}`
    },
    tradesRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
      padding: '12px 16px',
      fontSize: 13,
      color: theme.text,
      borderBottom: `1px solid ${theme.border}`
    },
    badge: {
      padding: '4px 8px',
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 500
    },
    aiSection: {
      marginTop: 24
    },
    aiContent: {
      background: theme.purpleBg,
      borderRadius: 12,
      padding: 20,
      border: `1px solid ${theme.purple}40`
    },
    aiLine: {
      fontSize: 13,
      color: theme.text,
      lineHeight: 1.6,
      margin: '0 0 8px'
    },
    historySidebar: {
      position: 'absolute',
      right: 0,
      top: 0,
      width: 280,
      background: theme.cardBg,
      borderRadius: 16,
      padding: 20,
      border: `1px solid ${theme.border}`,
      maxHeight: 500,
      overflowY: 'auto',
      zIndex: 10
    },
    historyTitle: {
      fontSize: 14,
      fontWeight: 600,
      color: theme.text,
      marginBottom: 16
    },
    historyEmpty: {
      fontSize: 13,
      color: theme.textMuted,
      textAlign: 'center'
    },
    historyItem: {
      padding: '12px',
      background: theme.inputBg,
      borderRadius: 10,
      marginBottom: 8,
      cursor: 'pointer'
    },
    historyHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 8
    },
    historySymbol: {
      fontWeight: 600,
      color: theme.text
    },
    historyStrategy: {
      fontSize: 11,
      color: theme.textMuted
    },
    historyMetrics: {
      display: 'flex',
      gap: 12,
      marginBottom: 4
    },
    historyMetric: {
      fontSize: 12,
      color: theme.textSecondary
    },
    historyDate: {
      fontSize: 11,
      color: theme.textMuted
    },
    quickGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 16
    },
    quickCard: {
      background: theme.inputBg,
      borderRadius: 12,
      padding: 16,
      border: `1px solid ${theme.border}`,
      position: 'relative'
    },
    quickTitle: {
      fontSize: 14,
      fontWeight: 600,
      color: theme.text,
      marginBottom: 12
    },
    quickMetrics: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8
    },
    quickMetric: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    },
    quickMetricLabel: {
      fontSize: 11,
      color: theme.textMuted
    },
    quickMetricValue: {
      fontSize: 16,
      fontWeight: 600,
      color: theme.text
    },
    bestBadge: {
      position: 'absolute',
      top: -8,
      right: 12,
      background: theme.green,
      color: 'white',
      padding: '4px 8px',
      borderRadius: 6,
      fontSize: 10,
      fontWeight: 600
    }
  };
}
