import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const themes = {
  dark: {
    name: 'dark',
    bg: '#0a0a0f',
    sidebarBg: '#0d0d14',
    cardBg: '#12121a',
    inputBg: '#1a1a2e',
    text: '#e0e0e0',
    textSecondary: '#a0a0b0',
    textMuted: '#666',
    accent: '#3b82f6',
    border: 'rgba(255,255,255,0.06)',
    borderHover: 'rgba(255,255,255,0.12)',
    green: '#22c55e',
    greenBg: 'rgba(34,197,94,0.15)',
    red: '#ef4444',
    redBg: 'rgba(239,68,68,0.15)',
    yellow: '#eab308',
    yellowBg: 'rgba(234,179,8,0.15)',
    blue: '#3b82f6',
    blueBg: 'rgba(59,130,246,0.15)',
    purple: '#8b5cf6',
    purpleBg: 'rgba(139,92,246,0.15)',
    chartUp: '#26a69a',
    chartDown: '#ef5350',
    overlay: 'rgba(0,0,0,0.8)',
    gradient: 'linear-gradient(transparent, #12121a)',
    shadow: '0 4px 20px rgba(0,0,0,0.4)',
    hoverBg: 'rgba(255,255,255,0.04)',
    tableBorder: 'rgba(255,255,255,0.06)',
    tableRowAlt: 'rgba(255,255,255,0.01)',
    badgeBg: 'rgba(255,255,255,0.06)',
    scrollbarTrack: '#0a0a0f',
    scrollbarThumb: '#333',
  },
  light: {
    name: 'light',
    bg: '#f0f2f5',
    sidebarBg: '#ffffff',
    cardBg: '#ffffff',
    inputBg: '#f5f5f8',
    text: '#1a1a2e',
    textSecondary: '#555666',
    textMuted: '#888999',
    accent: '#3b82f6',
    border: 'rgba(0,0,0,0.08)',
    borderHover: 'rgba(0,0,0,0.15)',
    green: '#16a34a',
    greenBg: 'rgba(22,163,74,0.1)',
    red: '#dc2626',
    redBg: 'rgba(220,38,38,0.1)',
    yellow: '#ca8a04',
    yellowBg: 'rgba(202,138,4,0.1)',
    blue: '#2563eb',
    blueBg: 'rgba(37,99,235,0.1)',
    purple: '#7c3aed',
    purpleBg: 'rgba(124,58,237,0.1)',
    chartUp: '#16a34a',
    chartDown: '#dc2626',
    overlay: 'rgba(0,0,0,0.5)',
    gradient: 'linear-gradient(transparent, #ffffff)',
    shadow: '0 4px 20px rgba(0,0,0,0.08)',
    hoverBg: 'rgba(0,0,0,0.03)',
    tableBorder: 'rgba(0,0,0,0.08)',
    tableRowAlt: 'rgba(0,0,0,0.02)',
    badgeBg: 'rgba(0,0,0,0.05)',
    scrollbarTrack: '#f0f2f5',
    scrollbarThumb: '#ccc',
  }
};

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState(() => localStorage.getItem('theme') || 'dark');
  const theme = themes[themeName] || themes.dark;
  useEffect(() => { localStorage.setItem('theme', themeName); }, [themeName]);
  return <ThemeContext.Provider value={{ theme, themeName, setThemeName }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
