import React, { useState } from 'react';
import { useLang } from './LangContext';
import { useAuth } from './AuthContext';

const EyeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const s = {
  page: {
    minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Inter', sans-serif", padding: 20
  },
  card: {
    background: '#12121a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20,
    padding: '40px 36px', width: '100%', maxWidth: 420, position: 'relative'
  },
  logo: { textAlign: 'center', fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 32 },
  accent: { color: '#3b82f6' },
  tabs: { display: 'flex', gap: 0, marginBottom: 32, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4 },
  tab: (active) => ({
    flex: 1, padding: '10px 0', textAlign: 'center', borderRadius: 8, border: 'none',
    background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
    color: active ? '#3b82f6' : '#707080', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: "'Inter',sans-serif", transition: 'all 0.2s'
  }),
  input: {
    width: '100%', padding: '14px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: '#e0e0e0', fontSize: 15,
    fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  passwordInput: {
    width: '100%', padding: '14px 48px 14px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: '#e0e0e0', fontSize: 15,
    fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  label: { fontSize: 13, color: '#808090', marginBottom: 6, display: 'block' },
  btn: {
    width: '100%', padding: '14px 0', borderRadius: 10, border: 'none',
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff',
    fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
    transition: 'all 0.2s', boxShadow: '0 4px 20px rgba(59,130,246,0.3)', marginTop: 8
  },
  btnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  error: {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#ef4444', fontSize: 14
  },
  back: {
    position: 'absolute', top: 16, left: 16, background: 'none', border: 'none',
    color: '#707080', fontSize: 14, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
    padding: '4px 8px'
  },
  eyeBtn: {
    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', color: '#707080', cursor: 'pointer',
    padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  fieldGroup: { marginBottom: 16 },
  passwordWrap: { position: 'relative' },
};

function PasswordField({ label, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div style={s.fieldGroup}>
      <label style={s.label}>{label}</label>
      <div style={s.passwordWrap}>
        <input
          style={s.passwordInput}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.5)'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
        />
        <button type="button" style={s.eyeBtn} onClick={() => setShow(!show)} tabIndex={-1}>
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}

export default function AuthPage({ initialTab = 'login', onBack }) {
  const { t } = useLang();
  const { login: authLogin } = useAuth();
  const [tab, setTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regPass2, setRegPass2] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!loginEmail || !loginPass) { setError(t('errorEmailRequired')); return; }
    setLoading(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPass })
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || t('errorInvalidCredentials')); setLoading(false); return; }
      authLogin(data.accessToken, data.refreshToken, data.user);
    } catch { setError('Network error'); }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!regEmail || !regPass) { setError(t('errorEmailRequired')); return; }
    if (regPass.length < 6) { setError(t('errorPasswordShort')); return; }
    if (regPass !== regPass2) { setError(t('errorPasswordMismatch')); return; }
    setLoading(true);
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName, email: regEmail, password: regPass })
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || t('errorUserExists')); setLoading(false); return; }
      authLogin(data.accessToken, data.refreshToken, data.user);
    } catch { setError('Network error'); }
    setLoading(false);
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <button style={s.back} onClick={onBack}>← {t('backToHome')}</button>
        <div style={s.logo}>Kotvuk<span style={s.accent}>AI</span></div>
        <div style={s.tabs}>
          <button style={s.tab(tab === 'login')} onClick={() => { setTab('login'); setError(''); }}>{t('login')}</button>
          <button style={s.tab(tab === 'register')} onClick={() => { setTab('register'); setError(''); }}>{t('register')}</button>
        </div>

        {error && <div style={s.error}>{error}</div>}

        {tab === 'login' ? (
          <form onSubmit={handleLogin}>
            <div style={s.fieldGroup}>
              <label style={s.label}>{t('email')}</label>
              <input style={s.input} type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                placeholder="user@example.com" onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
            </div>
            <PasswordField label={t('password')} value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="••••••" />
            <button type="submit" style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }} disabled={loading}>
              {loading ? t('loading') : t('loginButton')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div style={s.fieldGroup}>
              <label style={s.label}>{t('name')}</label>
              <input style={s.input} type="text" value={regName} onChange={e => setRegName(e.target.value)}
                placeholder={t('name')} onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>{t('email')}</label>
              <input style={s.input} type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                placeholder="user@example.com" onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
            </div>
            <PasswordField label={t('password')} value={regPass} onChange={e => setRegPass(e.target.value)} placeholder="••••••" />
            <PasswordField label={t('confirmPassword')} value={regPass2} onChange={e => setRegPass2(e.target.value)} placeholder="••••••" />
            <button type="submit" style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }} disabled={loading}>
              {loading ? t('loading') : t('registerButton')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
