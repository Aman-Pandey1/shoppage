import React, { useState } from 'react';
import { login, loginUser, postJson, setAuthToken } from '../lib/api';

export const LoginModal = ({ open, onClose, onSuccess, mode = 'user' }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  // Only applicable for user auth; admin stays login-only
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      if (mode === 'admin') {
        await login(email, password);
      } else if (authMode === 'register') {
        const res = await postJson('/api/user/register', { email, password, name });
        if (res?.token) setAuthToken(res.token);
      } else {
        await loginUser(email, password);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <div className="cart-backdrop" data-show="true" onClick={onClose} />
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(92vw, 420px)',
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 16,
        boxShadow: 'var(--shadow-pop)'
      }} className="animate-popIn">
        <h3 style={{ marginTop: 0 }}>
          {mode === 'admin' ? 'Admin Login' : (authMode === 'register' ? 'Create account' : 'Login')}
        </h3>
        {error ? <div style={{ color: 'var(--danger)', marginBottom: 8 }}>{error}</div> : null}
        {mode !== 'admin' ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button className={authMode === 'login' ? 'primary-btn' : ''} onClick={() => setAuthMode('login')}>Login</button>
            <button className={authMode === 'register' ? 'primary-btn' : ''} onClick={() => setAuthMode('register')}>Sign-Up</button>
          </div>
        ) : null}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }} autoComplete="on">
          {mode !== 'admin' && authMode === 'register' ? (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
          ) : null}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'admin' || authMode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>
            <button type="button" onClick={onClose}>Cancel</button>
            <button className="primary-btn" disabled={loading}>
              {loading ? (mode === 'admin' ? 'Logging in...' : (authMode === 'register' ? 'Creating…' : 'Logging in...')) : (mode === 'admin' ? 'Login' : (authMode === 'register' ? 'Create account' : 'Login'))}
            </button>
          </div>
        </form>
        {/* No default credentials shown */}
      </div>
    </div>
  );
}

