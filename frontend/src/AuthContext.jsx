import React, { createContext, useContext, useState, useEffect } from 'react';
const AuthContext = createContext();
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(u => { setUser(u); setLoading(false); })
        .catch(() => { setToken(null); localStorage.removeItem('token'); localStorage.removeItem('refreshToken'); setLoading(false); });
    } else { setLoading(false); }
  }, [token]);

  function login(accessToken, refreshToken, userData) {
    localStorage.setItem('token', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    setToken(accessToken);
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setUser(null);
  }

  async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token');
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    if (!res.ok) throw new Error('Refresh failed');
    const data = await res.json();
    localStorage.setItem('token', data.accessToken);
    if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
    setToken(data.accessToken);
    return data.accessToken;
  }

  async function authFetch(url, options = {}) {
    let currentToken = localStorage.getItem('token');
    const makeRequest = (t) => fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${t}` }
    });
    let res = await makeRequest(currentToken);
    if (res.status === 401) {
      try {
        const newToken = await refreshAccessToken();
        res = await makeRequest(newToken);
      } catch {
        logout();
        throw new Error('Session expired');
      }
    }
    return res;
  }

  return <AuthContext.Provider value={{ user, token, login, logout, loading, authFetch, refreshAccessToken }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
