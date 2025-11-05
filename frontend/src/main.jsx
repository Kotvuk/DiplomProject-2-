import React from 'react';
import { createRoot } from 'react-dom/client';
import { LangProvider } from './LangContext';
import { AuthProvider } from './AuthContext';
import { ThemeProvider } from './ThemeContext';
import App from './App';

createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <LangProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </LangProvider>
  </ThemeProvider>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((reg) => console.log('SW registered:', reg.scope))
      .catch((err) => console.log('SW registration failed:', err));
  });
}
