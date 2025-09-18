import React, { useState } from 'react';
import { login, loginUser } from '../lib/api';

export const LoginModal = ({ open, onClose, onSuccess, mode = 'user' }) => {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      if (mode === 'admin') {
        await login(email, password);
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
        <h3 style={{ marginTop: 0 }}>{mode === 'admin' ? 'Admin Login' : 'Login'}</h3>
        {error ? <div style={{ color: 'var(--danger)', marginBottom: 8 }}>{error}</div> : null}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button type="button" onClick={onClose}>Cancel</button>
            <button className="primary-btn" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </div>
        </form>
        {mode === 'admin' ? (
          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            Default admin: admin@example.com / admin123
          </div>
        ) : null}
      </div>
    </div>
  );
}

