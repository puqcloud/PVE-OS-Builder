import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('pve_token') || null);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('pve_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      if (token) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
          } else {
            logout();
          }
        } catch (_) {
          // Network error or backend offline
        }
      }
      setLoading(false);
    }
    checkAuth();
  }, [token]);

  async function login(username, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Authentication failed');
    }

    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('pve_token', data.token);
    localStorage.setItem('pve_user', JSON.stringify(data.user));
    return data;
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem('pve_token');
    localStorage.removeItem('pve_user');
  }

  // Authenticated fetch wrapper
  async function apiFetch(url, options = {}) {
    const headers = {
      ...(options.headers || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (!(options.body instanceof FormData) && !headers['Content-Type'] && options.method && options.method !== 'GET') {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      logout();
      throw new Error('Session expired. Please log in again.');
    }
    return res;
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: !!token,
        loading,
        login,
        logout,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
