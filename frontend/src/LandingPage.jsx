import React, { useState, useEffect } from 'react';
import { useLang } from './LangContext';

const s = {
  page: { minHeight: '100vh', background: '#0a0a0f', color: '#e0e0e0', fontFamily: "'Inter', sans-serif", overflow: 'auto' },
  header: {
    position: 'sticky', top: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 40px', background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(255,255,255,0.06)'
  },
  logo: { fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: -0.5 },
  accent: { color: '#3b82f6' },
  headerBtns: { display: 'flex', gap: 12 },
  btnLogin: {
    padding: '10px 24px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.5)', background: 'transparent',
    color: '#3b82f6', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
    transition: 'all 0.2s'
  },
  btnRegister: {
    padding: '10px 24px', borderRadius: 8, border: 'none',
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
    transition: 'all 0.2s', boxShadow: '0 4px 20px rgba(59,130,246,0.3)'
  },
  hero: {
    textAlign: 'center', padding: '120px 20px 80px', position: 'relative',
    background: 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.08) 0%, transparent 60%)'
  },
  heroTitle: { fontSize: 64, fontWeight: 800, letterSpacing: -2, marginBottom: 16, lineHeight: 1.1 },
  heroGradient: { background: 'linear-gradient(135deg, #3b82f6, #60a5fa, #93c5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  heroSub: { fontSize: 22, color: '#a0a0b0', marginBottom: 24, fontWeight: 400 },
  heroDesc: { fontSize: 16, color: '#707080', maxWidth: 600, margin: '0 auto 48px', lineHeight: 1.7 },
  heroBtns: { display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' },
  btnHeroLogin: {
    padding: '16px 40px', borderRadius: 12, border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.1)',
    color: '#3b82f6', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
    transition: 'all 0.3s'
  },
  btnHeroReg: {
    padding: '16px 40px', borderRadius: 12, border: 'none',
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff',
    fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
    transition: 'all 0.3s', boxShadow: '0 8px 32px rgba(59,130,246,0.3)'
  },
  section: { padding: '80px 40px', maxWidth: 1200, margin: '0 auto' },
  sectionTitle: { fontSize: 36, fontWeight: 700, textAlign: 'center', marginBottom: 12, color: '#fff' },
  sectionSub: { fontSize: 16, color: '#707080', textAlign: 'center', marginBottom: 48 },
  featGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 },
  featCard: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16, padding: '32px 28px', transition: 'all 0.3s',
    cursor: 'default'
  },
  featIcon: { fontSize: 40, marginBottom: 16 },
  featTitle: { fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 8 },
  featDesc: { fontSize: 14, color: '#808090', lineHeight: 1.6 },
  pricingGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 },
  priceCard: (highlight) => ({
    background: highlight ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.03)',
    border: highlight ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16, padding: '40px 32px', textAlign: 'center', position: 'relative',
    transition: 'all 0.3s'
  }),
  priceName: { fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 8 },
  priceAmount: { fontSize: 40, fontWeight: 800, marginBottom: 24 },
  priceFeatures: { listStyle: 'none', padding: 0, margin: '0 0 32px', textAlign: 'left' },
  priceFeat: { padding: '8px 0', fontSize: 14, color: '#a0a0b0', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  badge: {
    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff',
    padding: '4px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600
  },
  footer: {
    textAlign: 'center', padding: '40px 20px', borderTop: '1px solid rgba(255,255,255,0.06)',
    color: '#505060', fontSize: 14
  },
  langSwitch: {
    padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent', color: '#a0a0b0', fontSize: 13, cursor: 'pointer',
    fontFamily: "'Inter',sans-serif", marginRight: 8
  },
  statsRow: {
    display: 'flex', justifyContent: 'center', gap: 48, padding: '40px 20px 0', flexWrap: 'wrap'
  },
  statItem: { textAlign: 'center' },
  statNum: { fontSize: 32, fontWeight: 800, color: '#3b82f6' },
  statLabel: { fontSize: 13, color: '#707080', marginTop: 4 },
};

export default function LandingPage({ onLogin, onRegister }) {
  const { t, lang, setLang } = useLang();
  const [hoveredFeat, setHoveredFeat] = useState(null);

  const features = [
    { icon: '📊', titleKey: 'featureChartsTitle', descKey: 'featureChartsDesc' },
    { icon: '🤖', titleKey: 'featureAITitle', descKey: 'featureAIDesc' },
    { icon: '🐋', titleKey: 'featureWhaleTitle', descKey: 'featureWhaleDesc' },
    { icon: '🔔', titleKey: 'featureAlertsTitle', descKey: 'featureAlertsDesc' },
    { icon: '📚', titleKey: 'featureLearningTitle', descKey: 'featureLearningDesc' },
    { icon: '🗺️', titleKey: 'featureHeatmapTitle', descKey: 'featureHeatmapDesc' },
  ];

  const plans = [
    { name: t('planFree'), price: t('planFreePrice'), features: t('freeFeatures').split('\n'), highlight: false },
    { name: t('planPro'), price: t('planProPrice'), features: t('proFeatures').split('\n'), highlight: true },
    { name: t('planPremium'), price: t('planPremiumPrice'), features: t('premiumFeatures').split('\n'), highlight: false },
  ];

  return (
    <div style={s.page}>
      {}
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={s.logo}>Kotvuk<span style={s.accent}>AI</span></span>
        </div>
        <div style={s.headerBtns}>
          <button style={s.langSwitch} onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}>
            {lang === 'ru' ? '🇬🇧 EN' : '🇷🇺 RU'}
          </button>
          <button style={s.btnLogin} onClick={onLogin}>{t('login')}</button>
          <button style={s.btnRegister} onClick={onRegister}>{t('register')}</button>
        </div>
      </div>

      {}
      <div style={s.hero}>
        <h1 style={s.heroTitle}>
          <span style={s.heroGradient}>KotvukAI</span>
        </h1>
        <p style={s.heroSub}>{t('heroSubtitle')}</p>
        <p style={s.heroDesc}>{t('heroDesc')}</p>
        <div style={s.heroBtns}>
          <button style={s.btnHeroLogin} onClick={onLogin}>{t('login')}</button>
          <button style={s.btnHeroReg} onClick={onRegister}>{t('register')}</button>
        </div>
        <div style={s.statsRow}>
          <div style={s.statItem}><div style={s.statNum}>14+</div><div style={s.statLabel}>{t('statPanels')}</div></div>
          <div style={s.statItem}><div style={s.statNum}>AI</div><div style={s.statLabel}>{t('statRealtime')}</div></div>
          <div style={s.statItem}><div style={s.statNum}>24/7</div><div style={s.statLabel}>{t('statMonitoring')}</div></div>
          <div style={s.statItem}><div style={s.statNum}>100+</div><div style={s.statLabel}>{t('statPairs')}</div></div>
        </div>
      </div>

      {}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>{t('featuresTitle')}</h2>
        <p style={s.sectionSub}>{t('featuresSub')}</p>
        <div style={s.featGrid}>
          {features.map((f, i) => (
            <div key={i} style={{
              ...s.featCard,
              ...(hoveredFeat === i ? { borderColor: 'rgba(59,130,246,0.3)', transform: 'translateY(-4px)' } : {})
            }}
              onMouseEnter={() => setHoveredFeat(i)}
              onMouseLeave={() => setHoveredFeat(null)}
            >
              <div style={s.featIcon}>{f.icon}</div>
              <div style={s.featTitle}>{t(f.titleKey)}</div>
              <div style={s.featDesc}>{t(f.descKey)}</div>
            </div>
          ))}
        </div>
      </div>

      {}
      <div style={{ ...s.section, background: 'rgba(255,255,255,0.01)', borderRadius: 24 }}>
        <h2 style={s.sectionTitle}>{t('pricingTitle')}</h2>
        <p style={s.sectionSub}>{t('pricingSub')}</p>
        <div style={s.pricingGrid}>
          {plans.map((p, i) => (
            <div key={i} style={s.priceCard(p.highlight)}>
              {p.highlight && <div style={s.badge}>{t('popular')}</div>}
              <div style={s.priceName}>{p.name}</div>
              <div style={{ ...s.priceAmount, color: p.highlight ? '#3b82f6' : '#fff' }}>{p.price}</div>
              <ul style={s.priceFeatures}>
                {p.features.map((feat, j) => (
                  <li key={j} style={s.priceFeat}>✓ {feat}</li>
                ))}
              </ul>
              <button style={p.highlight ? s.btnHeroReg : s.btnHeroLogin} onClick={onRegister}>
                {t('getStarted')}
              </button>
            </div>
          ))}
        </div>
      </div>

      {}
      <div style={s.footer}>
        KotvukAI © 2025 — {t('allRightsReserved')}
      </div>
    </div>
  );
}
