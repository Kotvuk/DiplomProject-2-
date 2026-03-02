import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '../LangContext';
import { useTheme } from '../ThemeContext';

function formatAIText(text) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) return <strong key={i} style={{ color: 'inherit', fontWeight: 700 }}>{part}</strong>;
    const lines = part.split('\n');
    return lines.map((line, j) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) return <div key={`${i}-${j}`} style={{ paddingLeft: 12 }}>• {trimmed.slice(2)}</div>;
      if (/^\d+\.\s/.test(trimmed)) return <div key={`${i}-${j}`} style={{ paddingLeft: 12 }}>{trimmed}</div>;
      return line ? <span key={`${i}-${j}`}>{line}{j < lines.length - 1 ? <br /> : null}</span> : (j < lines.length - 1 ? <br key={`${i}-${j}`} /> : null);
    });
  });
}

export default function AIChat() {
  const { t } = useLang();
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEnd = useRef(null);

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const newMsgs = [...messages, { role: 'user', content: text }];
    setMessages(newMsgs);
    setLoading(true);
    try {
      const r = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, history: newMsgs.slice(-10) }) });
      const data = await r.json();
      setMessages([...newMsgs, { role: 'assistant', content: data.reply || data.error || 'Error' }]);
    } catch (e) {
      setMessages([...newMsgs, { role: 'assistant', content: 'Error: ' + e.message }]);
    }
    setLoading(false);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed', bottom: 96, right: 24, width: 350, height: 500,
              background: theme.sidebarBg, border: '1px solid ' + theme.border, borderRadius: 16,
              display: 'flex', flexDirection: 'column', zIndex: 9999, overflow: 'hidden',
              boxShadow: theme.shadow,
            }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderBottom: '1px solid ' + theme.border, background: theme.cardBg,
            }}>
              <span style={{ color: theme.text, fontWeight: 600, fontSize: 15 }}>{t('chatTitle')}</span>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: theme.textMuted, fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: theme.textMuted, fontSize: 13, marginTop: 40 }}>
                  {t('chatPlaceholder')}
                </div>
              )}
              {messages.map((m, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={m.role === 'user' ? {
                    alignSelf: 'flex-end', background: theme.accent, color: '#fff', padding: '8px 12px',
                    borderRadius: '12px 12px 4px 12px', maxWidth: '80%', fontSize: 13, lineHeight: 1.5
                  } : {
                    alignSelf: 'flex-start', background: theme.inputBg, color: theme.text, padding: '8px 12px',
                    borderRadius: '12px 12px 12px 4px', maxWidth: '80%', fontSize: 13, lineHeight: 1.5
                  }}>
                  {m.role === 'user' ? m.content : formatAIText(m.content)}
                </motion.div>
              ))}
              {loading && <div style={{ alignSelf: 'flex-start', color: theme.textMuted, fontSize: 13, padding: '8px 12px' }}>{t('analyzing')}</div>}
              <div ref={messagesEnd} />
            </div>
            <div style={{
              display: 'flex', gap: 8, padding: 12, borderTop: '1px solid ' + theme.border, background: theme.cardBg,
            }}>
              <input
                style={{
                  flex: 1, background: theme.inputBg, border: '1px solid ' + theme.border,
                  borderRadius: 8, padding: '8px 12px', color: theme.text, fontSize: 13,
                  fontFamily: "'Inter',sans-serif", outline: 'none'
                }}
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder={t('chatPlaceholder')}
              />
              <motion.button
                style={{ background: theme.accent, border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
                onClick={send} disabled={loading}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                {t('chatSend')}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        style={{
          position: 'fixed', bottom: 24, right: 24, width: 60, height: 60, borderRadius: '50%',
          background: theme.accent, border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          boxShadow: '0 4px 20px ' + theme.accent + '66',
        }}
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </motion.button>
    </>
  );
}
