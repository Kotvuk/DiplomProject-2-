import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../ThemeContext';
import { useLang } from '../LangContext';
import { useAuth } from '../AuthContext';

const icons = {
  bot: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="3"/><path d="M12 8v3"/><path d="M8 16h.01M16 16h.01"/></svg>,
  play: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  stop: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  plus: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  trash: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  brain: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2"/></svg>,
  chart: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>,
};

const STRATEGIES = [
  { id: 'ema_cross', name: 'EMA Crossover' },
  { id: 'rsi_reversal', name: 'RSI Reversal' },
  { id: 'macd_signal', name: 'MACD Signal' },
  { id: 'bollinger_breakout', name: 'Bollinger Breakout' },
  { id: 'support_resistance', name: 'Support/Resistance' },
];

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];

export default function TradingBotsPanel() {
  const { theme } = useTheme();
  const { t } = useLang();
  const { authFetch } = useAuth();

  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedBot, setSelectedBot] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

  const [newBot, setNewBot] = useState({
    name: '',
    symbol: 'BTCUSDT',
    strategy: 'ema_cross',
    capital: 5000,
    leverage: 1
  });

  const styles = getStyles(theme);

  useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/bots');
      if (res.ok) {
        const data = await res.json();
        setBots(data);
      }
    } catch (e) {
      console.error('Error loading bots:', e);
    } finally {
      setLoading(false);
    }
  };

  const createBot = async () => {
    if (!newBot.name || newBot.name.length < 3) {
      alert('Bot name must be at least 3 characters');
      return;
    }

    try {
      const res = await authFetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBot)
      });

      if (res.ok) {
        const data = await res.json();
        setBots([...bots, data]);
        setShowCreate(false);
        setNewBot({
          name: '',
          symbol: 'BTCUSDT',
          strategy: 'ema_cross',
          capital: 5000,
          leverage: 1
        });
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create bot');
      }
    } catch (e) {
      console.error('Error creating bot:', e);
      alert('Failed to create bot');
    }
  };

  const startBot = async (botId) => {
    try {
      const res = await authFetch(`/api/bots/${botId}/start`, { method: 'POST' });
      if (res.ok) {
        loadBots();
      } else {
        const error = await res.json();
        alert(error.error);
      }
    } catch (e) {
      console.error('Error starting bot:', e);
    }
  };

  const stopBot = async (botId) => {
    try {
      const res = await authFetch(`/api/bots/${botId}/stop`, { method: 'POST' });
      if (res.ok) {
        loadBots();
      }
    } catch (e) {
      console.error('Error stopping bot:', e);
    }
  };

  const deleteBot = async (botId) => {
    if (!confirm('Are you sure you want to delete this bot?')) return;

    try {
      const res = await authFetch(`/api/bots/${botId}`, { method: 'DELETE' });
      if (res.ok) {
        setBots(bots.filter(b => b.id !== botId));
        if (selectedBot?.id === botId) {
          setSelectedBot(null);
        }
      }
    } catch (e) {
      console.error('Error deleting bot:', e);
    }
  };

  const runAnalysis = async (botId) => {
    setAnalysisResult({ loading: true });
    try {
      const res = await authFetch(`/api/bots/${botId}/analyze`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAnalysisResult(data);
      }
    } catch (e) {
      console.error('Error running analysis:', e);
      setAnalysisResult({ error: 'Failed to run analysis' });
    }
  };

  const runningBots = bots.filter(b => b.status === 'running');
  const stoppedBots = bots.filter(b => b.status !== 'running');

  return (
    <div style={styles.container}>
      {}
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <span style={styles.icon}>{icons.bot}</span>
          <h2 style={styles.title}>AI Trading Bots</h2>
          {runningBots.length > 0 && (
            <span style={styles.activeBadge}>
              {runningBots.length} active
            </span>
          )}
        </div>
        <motion.button
          style={styles.createBtn}
          onClick={() => setShowCreate(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {icons.plus}
          <span>Create Bot</span>
        </motion.button>
      </div>

      {}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Total Bots</span>
          <span style={styles.statValue}>{bots.length}</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Running</span>
          <span style={{ ...styles.statValue, color: theme.green }}>{runningBots.length}</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Total Trades</span>
          <span style={styles.statValue}>
            {bots.reduce((sum, b) => sum + (b.total_trades || 0), 0)}
          </span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Avg Win Rate</span>
          <span style={{ ...styles.statValue, color: theme.accent }}>
            {bots.length > 0
              ? (bots.reduce((sum, b) => sum + (b.win_rate || 0), 0) / bots.length).toFixed(1)
              : 0}%
          </span>
        </div>
      </div>

      {}
      <div style={styles.grid}>
        {}
        <div style={styles.botsList}>
          {loading ? (
            <div style={styles.loading}>Loading bots...</div>
          ) : bots.length === 0 ? (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>🤖</span>
              <h3 style={styles.emptyTitle}>No Bots Yet</h3>
              <p style={styles.emptyText}>
                Create your first AI trading bot to get started
              </p>
              <motion.button
                style={styles.createBtnLarge}
                onClick={() => setShowCreate(true)}
                whileHover={{ scale: 1.02 }}
              >
                {icons.plus} Create Your First Bot
              </motion.button>
            </div>
          ) : (
            <>
              {runningBots.length > 0 && (
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>🟢 Running</h3>
                  {runningBots.map(bot => (
                    <BotCard
                      key={bot.id}
                      bot={bot}
                      theme={theme}
                      styles={styles}
                      onStart={startBot}
                      onStop={stopBot}
                      onDelete={deleteBot}
                      onSelect={() => setSelectedBot(bot)}
                      isSelected={selectedBot?.id === bot.id}
                    />
                  ))}
                </div>
              )}

              {stoppedBots.length > 0 && (
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>⚪ Stopped</h3>
                  {stoppedBots.map(bot => (
                    <BotCard
                      key={bot.id}
                      bot={bot}
                      theme={theme}
                      styles={styles}
                      onStart={startBot}
                      onStop={stopBot}
                      onDelete={deleteBot}
                      onSelect={() => setSelectedBot(bot)}
                      isSelected={selectedBot?.id === bot.id}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {}
        <div style={styles.detailsPanel}>
          {selectedBot ? (
            <div>
              <div style={styles.detailsHeader}>
                <h3 style={styles.detailsTitle}>{selectedBot.name}</h3>
                <button
                  style={styles.closeBtn}
                  onClick={() => {
                    setSelectedBot(null);
                    setAnalysisResult(null);
                  }}
                >
                  ✕
                </button>
              </div>

              {}
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Symbol</span>
                  <span style={styles.infoValue}>{selectedBot.symbol}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Strategy</span>
                  <span style={styles.infoValue}>{selectedBot.strategy}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Capital</span>
                  <span style={styles.infoValue}>${selectedBot.capital?.toLocaleString()}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Leverage</span>
                  <span style={styles.infoValue}>{selectedBot.leverage}x</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Total Trades</span>
                  <span style={styles.infoValue}>{selectedBot.total_trades || 0}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Win Rate</span>
                  <span style={{ ...styles.infoValue, color: theme.green }}>
                    {(selectedBot.win_rate || 0).toFixed(1)}%
                  </span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>ROI</span>
                  <span style={{
                    ...styles.infoValue,
                    color: (selectedBot.roi || 0) >= 0 ? theme.green : theme.red
                  }}>
                    {(selectedBot.roi || 0).toFixed(1)}%
                  </span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Status</span>
                  <span style={{
                    ...styles.statusBadge,
                    background: selectedBot.status === 'running' ? theme.greenBg : theme.badgeBg,
                    color: selectedBot.status === 'running' ? theme.green : theme.textMuted
                  }}>
                    {selectedBot.status}
                  </span>
                </div>
              </div>

              {}
              <div style={styles.botActions}>
                {selectedBot.status === 'running' ? (
                  <motion.button
                    style={styles.stopBtn}
                    onClick={() => stopBot(selectedBot.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {icons.stop} Stop Bot
                  </motion.button>
                ) : (
                  <motion.button
                    style={styles.startBtn}
                    onClick={() => startBot(selectedBot.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {icons.play} Start Bot
                  </motion.button>
                )}

                <motion.button
                  style={styles.analyzeBtn}
                  onClick={() => runAnalysis(selectedBot.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {icons.brain} Self-Analysis
                </motion.button>
              </div>

              {}
              {analysisResult && (
                <div style={styles.analysisSection}>
                  <h4 style={styles.analysisTitle}>🧠 Self-Analysis Result</h4>
                  {analysisResult.loading ? (
                    <div style={styles.analysisLoading}>Analyzing bot performance...</div>
                  ) : analysisResult.error ? (
                    <div style={styles.analysisError}>{analysisResult.error}</div>
                  ) : (
                    <div>
                      {}
                      {analysisResult.metrics && (
                        <div style={styles.analysisMetrics}>
                          <div style={styles.analysisMetric}>
                            <span>Win Rate</span>
                            <strong>{analysisResult.metrics.winRate?.toFixed(1)}%</strong>
                          </div>
                          <div style={styles.analysisMetric}>
                            <span>Profit Factor</span>
                            <strong>{analysisResult.metrics.profitFactor?.toFixed(2)}</strong>
                          </div>
                          <div style={styles.analysisMetric}>
                            <span>Total PnL</span>
                            <strong style={{
                              color: analysisResult.metrics.totalPnl >= 0 ? theme.green : theme.red
                            }}>
                              ${analysisResult.metrics.totalPnl?.toFixed(2)}
                            </strong>
                          </div>
                        </div>
                      )}

                      {}
                      {analysisResult.aiAnalysis && (
                        <div style={styles.aiAnalysis}>
                          {analysisResult.aiAnalysis.split('\n').map((line, i) => (
                            <p key={i} style={styles.aiLine}>{line}</p>
                          ))}
                        </div>
                      )}

                      {}
                      {analysisResult.suggestions?.length > 0 && (
                        <div style={styles.suggestions}>
                          <h5 style={styles.suggestionsTitle}>💡 Suggestions</h5>
                          {analysisResult.suggestions.map((s, i) => (
                            <div key={i} style={styles.suggestion}>
                              <strong>{s.param}:</strong> {s.value}
                              <span style={styles.suggestionReason}>{s.reason}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={styles.emptyDetails}>
              <span style={styles.emptyIcon}>📊</span>
              <p style={styles.emptyText}>Select a bot to view details</p>
            </div>
          )}
        </div>
      </div>

      {}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            style={styles.modal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              style={styles.modalContent}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={styles.modalTitle}>🤖 Create New Bot</h3>

              <div style={styles.field}>
                <label style={styles.label}>Bot Name</label>
                <input
                  style={styles.input}
                  value={newBot.name}
                  onChange={e => setNewBot({ ...newBot, name: e.target.value })}
                  placeholder="My BTC Bot"
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Symbol</label>
                <select
                  style={styles.select}
                  value={newBot.symbol}
                  onChange={e => setNewBot({ ...newBot, symbol: e.target.value })}
                >
                  {SYMBOLS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Strategy</label>
                <select
                  style={styles.select}
                  value={newBot.strategy}
                  onChange={e => setNewBot({ ...newBot, strategy: e.target.value })}
                >
                  {STRATEGIES.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div style={styles.fieldRow}>
                <div style={styles.field}>
                  <label style={styles.label}>Capital ($)</label>
                  <input
                    style={styles.input}
                    type="number"
                    value={newBot.capital}
                    onChange={e => setNewBot({ ...newBot, capital: parseFloat(e.target.value) })}
                    min={100}
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Leverage</label>
                  <input
                    style={styles.input}
                    type="number"
                    value={newBot.leverage}
                    onChange={e => setNewBot({ ...newBot, leverage: parseFloat(e.target.value) })}
                    min={1}
                    max={10}
                  />
                </div>
              </div>

              <div style={styles.modalActions}>
                <button
                  style={styles.cancelBtn}
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
                <motion.button
                  style={styles.confirmBtn}
                  onClick={createBot}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {icons.bot} Create Bot
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BotCard({ bot, theme, styles, onStart, onStop, onDelete, onSelect, isSelected }) {
  return (
    <motion.div
      style={{
        ...styles.botCard,
        border: isSelected ? `2px solid ${theme.accent}` : styles.botCard.border
      }}
      onClick={onSelect}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <div style={styles.botHeader}>
        <span style={styles.botName}>{bot.name}</span>
        <span style={{
          ...styles.botStatus,
          background: bot.status === 'running' ? theme.greenBg : theme.badgeBg,
          color: bot.status === 'running' ? theme.green : theme.textMuted
        }}>
          {bot.status === 'running' ? '🟢' : '⚪'} {bot.symbol}
        </span>
      </div>

      <div style={styles.botStats}>
        <div style={styles.botStat}>
          <span style={styles.botStatLabel}>Strategy</span>
          <span style={styles.botStatValue}>{bot.strategy}</span>
        </div>
        <div style={styles.botStat}>
          <span style={styles.botStatLabel}>Win Rate</span>
          <span style={{ ...styles.botStatValue, color: theme.green }}>
            {(bot.win_rate || 0).toFixed(0)}%
          </span>
        </div>
        <div style={styles.botStat}>
          <span style={styles.botStatLabel}>ROI</span>
          <span style={{
            ...styles.botStatValue,
            color: (bot.roi || 0) >= 0 ? theme.green : theme.red
          }}>
            {(bot.roi || 0).toFixed(1)}%
          </span>
        </div>
        <div style={styles.botStat}>
          <span style={styles.botStatLabel}>Trades</span>
          <span style={styles.botStatValue}>{bot.total_trades || 0}</span>
        </div>
      </div>

      <div style={styles.botActions} onClick={e => e.stopPropagation()}>
        {bot.status === 'running' ? (
          <button
            style={styles.cardStopBtn}
            onClick={() => onStop(bot.id)}
          >
            {icons.stop}
          </button>
        ) : (
          <button
            style={styles.cardStartBtn}
            onClick={() => onStart(bot.id)}
          >
            {icons.play}
          </button>
        )}
        <button
          style={styles.cardDeleteBtn}
          onClick={() => onDelete(bot.id)}
        >
          {icons.trash}
        </button>
      </div>
    </motion.div>
  );
}

function getStyles(theme) {
  return {
    container: {
      display: 'flex',
      flexDirection: 'column',
      gap: 24
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
    activeBadge: {
      background: theme.greenBg,
      color: theme.green,
      padding: '4px 12px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600
    },
    createBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '12px 20px',
      background: theme.accent,
      border: 'none',
      borderRadius: 12,
      color: 'white',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer'
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 16
    },
    statCard: {
      background: theme.cardBg,
      borderRadius: 12,
      padding: '20px 24px',
      border: `1px solid ${theme.border}`
    },
    statLabel: {
      fontSize: 12,
      color: theme.textMuted,
      display: 'block',
      marginBottom: 4
    },
    statValue: {
      fontSize: 28,
      fontWeight: 700,
      color: theme.text
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: '1fr 400px',
      gap: 24
    },
    botsList: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    },
    section: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: 600,
      color: theme.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8
    },
    botCard: {
      background: theme.cardBg,
      borderRadius: 12,
      padding: 16,
      border: `1px solid ${theme.border}`,
      cursor: 'pointer'
    },
    botHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12
    },
    botName: {
      fontSize: 16,
      fontWeight: 600,
      color: theme.text
    },
    botStatus: {
      fontSize: 11,
      fontWeight: 500,
      padding: '4px 10px',
      borderRadius: 6
    },
    botStats: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 8
    },
    botStat: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    },
    botStatLabel: {
      fontSize: 10,
      color: theme.textMuted,
      textTransform: 'uppercase'
    },
    botStatValue: {
      fontSize: 14,
      fontWeight: 600,
      color: theme.text
    },
    cardStartBtn: {
      padding: '8px 12px',
      background: theme.greenBg,
      border: 'none',
      borderRadius: 8,
      color: theme.green,
      cursor: 'pointer'
    },
    cardStopBtn: {
      padding: '8px 12px',
      background: theme.redBg,
      border: 'none',
      borderRadius: 8,
      color: theme.red,
      cursor: 'pointer'
    },
    cardDeleteBtn: {
      padding: '8px 12px',
      background: theme.badgeBg,
      border: 'none',
      borderRadius: 8,
      color: theme.textMuted,
      cursor: 'pointer'
    },
    detailsPanel: {
      background: theme.cardBg,
      borderRadius: 16,
      padding: 24,
      border: `1px solid ${theme.border}`,
      minHeight: 400
    },
    detailsHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20
    },
    detailsTitle: {
      fontSize: 18,
      fontWeight: 700,
      color: theme.text,
      margin: 0
    },
    closeBtn: {
      background: 'none',
      border: 'none',
      color: theme.textMuted,
      fontSize: 18,
      cursor: 'pointer',
      padding: 4
    },
    infoGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 12,
      marginBottom: 20
    },
    infoItem: {
      background: theme.inputBg,
      borderRadius: 10,
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    },
    infoLabel: {
      fontSize: 11,
      color: theme.textMuted,
      textTransform: 'uppercase'
    },
    infoValue: {
      fontSize: 16,
      fontWeight: 600,
      color: theme.text
    },
    statusBadge: {
      padding: '4px 10px',
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 500,
      alignSelf: 'flex-start'
    },
    botActions: {
      display: 'flex',
      gap: 8,
      marginTop: 16
    },
    startBtn: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: '12px',
      background: theme.green,
      border: 'none',
      borderRadius: 10,
      color: 'white',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer'
    },
    stopBtn: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: '12px',
      background: theme.red,
      border: 'none',
      borderRadius: 10,
      color: 'white',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer'
    },
    analyzeBtn: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: '12px',
      background: theme.purpleBg,
      border: `1px solid ${theme.purple}`,
      borderRadius: 10,
      color: theme.purple,
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer'
    },
    analysisSection: {
      marginTop: 20,
      paddingTop: 20,
      borderTop: `1px solid ${theme.border}`
    },
    analysisTitle: {
      fontSize: 14,
      fontWeight: 600,
      color: theme.text,
      marginBottom: 12
    },
    analysisLoading: {
      color: theme.textMuted,
      fontSize: 13,
      textAlign: 'center',
      padding: 20
    },
    analysisError: {
      color: theme.red,
      fontSize: 13,
      textAlign: 'center',
      padding: 20
    },
    analysisMetrics: {
      display: 'flex',
      gap: 16,
      marginBottom: 16
    },
    analysisMetric: {
      flex: 1,
      background: theme.inputBg,
      borderRadius: 10,
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4
    },
    aiAnalysis: {
      background: theme.purpleBg,
      borderRadius: 12,
      padding: 16,
      border: `1px solid ${theme.purple}30`
    },
    aiLine: {
      fontSize: 13,
      color: theme.text,
      lineHeight: 1.6,
      margin: '0 0 8px'
    },
    suggestions: {
      marginTop: 16
    },
    suggestionsTitle: {
      fontSize: 13,
      fontWeight: 600,
      color: theme.text,
      marginBottom: 8
    },
    suggestion: {
      background: theme.inputBg,
      borderRadius: 8,
      padding: '10px 14px',
      marginBottom: 8,
      fontSize: 13,
      color: theme.text
    },
    suggestionReason: {
      display: 'block',
      fontSize: 11,
      color: theme.textMuted,
      marginTop: 4
    },
    emptyDetails: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: 300,
      textAlign: 'center'
    },
    loading: {
      color: theme.textMuted,
      textAlign: 'center',
      padding: 40
    },
    emptyState: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
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
    createBtnLarge: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 20,
      padding: '14px 28px',
      background: theme.accent,
      border: 'none',
      borderRadius: 12,
      color: 'white',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer'
    },
    modal: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    },
    modalContent: {
      background: theme.cardBg,
      borderRadius: 20,
      padding: 32,
      width: 400,
      maxWidth: '90%'
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 700,
      color: theme.text,
      margin: '0 0 24px'
    },
    field: {
      marginBottom: 16
    },
    fieldRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12,
      marginBottom: 16
    },
    label: {
      display: 'block',
      fontSize: 13,
      fontWeight: 500,
      color: theme.textSecondary,
      marginBottom: 6
    },
    input: {
      width: '100%',
      padding: '12px 16px',
      background: theme.inputBg,
      border: `1px solid ${theme.border}`,
      borderRadius: 10,
      color: theme.text,
      fontSize: 14,
      outline: 'none',
      boxSizing: 'border-box'
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
      outline: 'none',
      boxSizing: 'border-box'
    },
    modalActions: {
      display: 'flex',
      gap: 12,
      marginTop: 24
    },
    cancelBtn: {
      flex: 1,
      padding: '14px',
      background: 'transparent',
      border: `1px solid ${theme.border}`,
      borderRadius: 12,
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: 500,
      cursor: 'pointer'
    },
    confirmBtn: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: '14px',
      background: theme.accent,
      border: 'none',
      borderRadius: 12,
      color: 'white',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer'
    }
  };
}
