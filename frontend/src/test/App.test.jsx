import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import App from '../App';
import { ThemeProvider } from '../ThemeContext';
import { LangProvider } from '../LangContext';
import { AuthProvider } from '../AuthContext';

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_, tag) => {
      return React.forwardRef(({ children, ...props }, ref) => {

        const htmlProps = {};
        Object.keys(props).forEach(key => {
          if (!['initial', 'animate', 'exit', 'variants', 'whileHover', 'whileTap', 'transition', 'layout'].includes(key)) {
            htmlProps[key] = props[key];
          }
        });
        return React.createElement(tag, { ...htmlProps, ref }, children);
      });
    }
  }),
  AnimatePresence: ({ children }) => children,
  useAnimation: () => ({ start: vi.fn() }),
}));

global.fetch = vi.fn();

function renderApp() {
  return render(
    <ThemeProvider>
      <LangProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LangProvider>
    </ThemeProvider>
  );
}

describe('App Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    global.fetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
  });

  it('renders landing page when not authenticated', async () => {
    renderApp();
    await waitFor(() => {

      const textContent = document.body.textContent;
      expect(textContent).toContain('KotvukAI');
    });
  });
});
