import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from './LangContext';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import LandingPage from './LandingPage';
import AuthPage from './AuthPage';
import DashboardPanel from './panels/DashboardPanel';
import ChartsPanel from './panels/ChartsPanel';
import AIPanel from './panels/AIPanel';
import TradesPanel from './panels/TradesPanel';
import CalculatorPanel from './panels/CalculatorPanel';
import WhalePanel from './panels/WhalePanel';
import AlertsPanel from './panels/AlertsPanel';
import NewsPanel from './panels/NewsPanel';
import WatchlistPanel from './panels/WatchlistPanel';
import LearningPanel from './panels/LearningPanel';
import HeatmapPanel from './panels/HeatmapPanel';
import ScreenerPanel from './panels/ScreenerPanel';
import AdminPanel from './panels/AdminPanel';
import AIChat from './panels/AIChat';
import BacktestingPanel from './panels/BacktestingPanel';
import TradingBotsPanel from './panels/TradingBotsPanel';
import AdvancedAnalyticsPanel from './panels/AdvancedAnalyticsPanel';
import SentimentPanel from './panels/SentimentPanel';

var pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } }
};

const icons = {
  dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  charts: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  ai: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  trades: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  calc: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="8" y2="18"/><line x1="12" y1="18" x2="12" y2="18"/><line x1="16" y1="18" x2="16" y2="18"/></svg>,
  whale: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  alerts: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  news: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/></svg>,
  watchlist: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  heatmap: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="3" height="3"/><rect x="14" y="7" width="3" height="3"/><rect x="7" y="14" width="3" height="3"/><rect x="14" y="14" width="3" height="3"/></svg>,
  screener: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  learning: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  settings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  admin: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  backtest: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>,
  bots: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="3"/><path d="M12 8v3"/><path d="M8 16h.01M16 16h.01"/></svg>,
  analytics: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>,
  sentiment: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
};

const getStyles = (theme) => ({
  app: { display: 'flex', height: '100vh', background: theme.bg, color: theme.text, fontFamily: "'Inter', sans-serif", overflow: 'hidden' },
  sidebar: (open) => ({
    width: open ? 240 : 0, background: theme.sidebarBg, borderRight: '1px solid ' + theme.border,
    overflow: 'hidden', flexShrink: 0, display: 'flex', flexDirection: 'column',
    transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
  }),
  sidebarInner: { width: 240, padding: '1rem 0', height: '100%', overflowY: 'auto' },
  navItem: (active) => ({
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', cursor: 'pointer',
    background: active ? theme.accent + '18' : 'transparent', color: active ? theme.accent : theme.textSecondary,
    border: 'none', width: '100%', textAlign: 'left', fontSize: 13, fontWeight: active ? 600 : 400,
    fontFamily: "'Inter',sans-serif",
    borderLeft: active ? '3px solid ' + theme.accent : '3px solid transparent', transition: 'all 0.15s'
  }),
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: {
    display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px',
    borderBottom: '1px solid ' + theme.border, background: theme.sidebarBg, flexShrink: 0
  },
  burger: { background: 'none', border: 'none', color: theme.textSecondary, fontSize: 20, cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' },
  content: { flex: 1, overflow: 'auto', padding: 24, position: 'relative' },
  logo: { fontSize: 15, fontWeight: 600, color: theme.textSecondary, flex: 1, letterSpacing: -0.3 },
  accent: { color: theme.accent },
  logoutBtn: {
    padding: '6px 16px', borderRadius: 8, border: '1px solid ' + theme.border,
    background: 'transparent', color: theme.textSecondary, fontSize: 13, fontWeight: 500,
    cursor: 'pointer', fontFamily: "'Inter',sans-serif", transition: 'all 0.2s'
  },
  userInfo: { fontSize: 13, color: theme.textMuted, marginRight: 8 },
  loadingScreen: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh',
    background: theme.bg, color: theme.textSecondary, fontSize: 16, fontFamily: "'Inter',sans-serif"
  },
});

export default function App() {
  const { t } = useLang();
  const { user, loading, logout } = useAuth();
  const { theme } = useTheme();
  const [panel, setPanel] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [authView, setAuthView] = useState(null);

  const styles = getStyles(theme);

  if (loading) {
    return (
      <motion.div style={styles.loadingScreen} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {t('loading')}
      </motion.div>
    );
  }

  if (!user) {
    if (authView === 'login') return <AuthPage initialTab="login" onBack={() => setAuthView(null)} />;
    if (authView === 'register') return <AuthPage initialTab="register" onBack={() => setAuthView(null)} />;
    return <LandingPage onLogin={() => setAuthView('login')} onRegister={() => setAuthView('register')} />;
  }

  const basePanels = [
    { id: 'dashboard', icon: 'dashboard', labelKey: 'dashboard' },
    { id: 'charts', icon: 'charts', labelKey: 'charts' },
    { id: 'ai', icon: 'ai', labelKey: 'aiAnalytics' },
    { id: 'analytics', icon: 'analytics', labelKey: 'analytics' },
    { id: 'sentiment', icon: 'sentiment', labelKey: 'sentiment' },
    { id: 'backtest', icon: 'backtest', labelKey: 'backtesting' },
    { id: 'bots', icon: 'bots', labelKey: 'tradingBots' },
    { id: 'trades', icon: 'trades', labelKey: 'trades' },
    { id: 'calc', icon: 'calc', labelKey: 'calculator' },
    { id: 'whale', icon: 'whale', labelKey: 'whaleAnalysis' },
    { id: 'alerts', icon: 'alerts', labelKey: 'alerts' },
    { id: 'news', icon: 'news', labelKey: 'news' },
    { id: 'watchlist', icon: 'watchlist', labelKey: 'watchlist' },
    { id: 'heatmap', icon: 'heatmap', labelKey: 'heatmap' },
    { id: 'screener', icon: 'screener', labelKey: 'screener' },
    { id: 'learning', icon: 'learning', labelKey: 'learning' },
  ];

  const PANELS = user?.is_admin
    ? [...basePanels.slice(0, -1), { id: 'admin', icon: 'admin', labelKey: 'adminPanel' }, basePanels[basePanels.length - 1]]
    : basePanels;

  const renderPanel = () => {
    switch (panel) {
      case 'dashboard': return <DashboardPanel />;
      case 'charts': return <ChartsPanel />;
      case 'ai': return <AIPanel />;
      case 'analytics': return <AdvancedAnalyticsPanel />;
      case 'sentiment': return <SentimentPanel />;
      case 'backtest': return <BacktestingPanel />;
      case 'bots': return <TradingBotsPanel />;
      case 'trades': return <TradesPanel />;
      case 'calc': return <CalculatorPanel />;
      case 'whale': return <WhalePanel />;
      case 'alerts': return <AlertsPanel />;
      case 'news': return <NewsPanel />;
      case 'watchlist': return <WatchlistPanel />;
      case 'heatmap': return <HeatmapPanel />;
      case 'screener': return <ScreenerPanel />;
      case 'learning': return <LearningPanel />;
      case 'admin': return <AdminPanel />;
      default: return <DashboardPanel />;
    }
  };

  return (
    <div style={styles.app}>
      <div style={styles.sidebar(sidebarOpen)}>
        <div style={styles.sidebarInner}>
          <div style={{ padding: '12px 20px 20px', borderBottom: '1px solid ' + theme.border, marginBottom: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: theme.text, letterSpacing: -0.5 }}>Kotvuk<span style={styles.accent}>AI</span></span>
          </div>
          {PANELS.map((p, i) => (
            <motion.button
              key={p.id}
              style={styles.navItem(panel === p.id)}
              onClick={() => setPanel(p.id)}
              whileHover={{ x: 2, background: panel === p.id ? theme.accent + '18' : theme.hoverBg }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02, duration: 0.2 }}
            >
              <span style={{ display: 'flex', alignItems: 'center', opacity: panel === p.id ? 1 : 0.6 }}>{icons[p.icon]}</span>
              <span>{t(p.labelKey)}</span>
            </motion.button>
          ))}
        </div>
      </div>
      <div style={styles.main}>
        <div style={styles.header}>
          <motion.button
            style={styles.burger}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </motion.button>
          <span style={styles.logo}>Kotvuk<span style={styles.accent}>AI</span></span>
          <span style={styles.userInfo}>{user.name || user.email}</span>
          <motion.button
            style={styles.logoutBtn}
            onClick={logout}
            whileHover={{ scale: 1.03, borderColor: theme.red }}
            whileTap={{ scale: 0.97 }}
          >
            {t('logout')}
          </motion.button>
        </div>
        <div style={styles.content}>
          <AnimatePresence mode="wait">
            <motion.div
              key={panel}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {renderPanel()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <AIChat />
    </div>
  );
}
