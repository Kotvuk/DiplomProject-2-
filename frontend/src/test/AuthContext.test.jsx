import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from '../AuthContext';

global.fetch = vi.fn();

function TestComponent() {
  const { user, token, loading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'done'}</span>
      <span data-testid="user">{user ? user.email : 'none'}</span>
      <span data-testid="token">{token || 'no-token'}</span>
      <button data-testid="login-btn" onClick={() => login('test-token', { email: 'test@test.com' })}>Login</button>
      <button data-testid="logout-btn" onClick={() => logout()}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders with no user initially', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('done'));
    expect(screen.getByTestId('user').textContent).toBe('none');
  });

  it('loads user from stored token', async () => {
    localStorage.setItem('token', 'valid-token');
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1, email: 'stored@test.com', name: 'User', plan: 'Free' })
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('done'));
    expect(screen.getByTestId('user').textContent).toBe('stored@test.com');
  });

  it('clears token on failed auth check', async () => {
    localStorage.setItem('token', 'expired-token');
    global.fetch.mockResolvedValueOnce({ ok: false });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('done'));
    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(localStorage.getItem('token')).toBeNull();
  });
});
