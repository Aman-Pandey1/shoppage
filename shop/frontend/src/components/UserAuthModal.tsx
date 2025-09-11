import React, { useState } from 'react';
import { postJson, setAuthToken } from '../lib/api';
import { Modal } from './Modal';

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export const UserAuthModal: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const path = mode === 'login' ? '/api/user/login' : '/api/user/register';
      const body: any = { email, password };
      if (mode === 'register') body.name = name;
      const res = await postJson<{ token: string }>(path, body);
      if (res?.token) setAuthToken(res.token);
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={mode === 'login' ? 'Login' : 'Create account'}>
      {error ? <div style={{ color: 'var(--danger)', marginBottom: 8 }}>{error}</div> : null}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button className={mode === 'login' ? 'primary-btn' : ''} onClick={() => setMode('login')}>Login</button>
        <button className={mode === 'register' ? 'primary-btn' : ''} onClick={() => setMode('register')}>Sign up</button>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {mode === 'register' ? (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        ) : null}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary-btn" disabled={loading}>{loading ? 'Please wait…' : (mode === 'login' ? 'Login' : 'Create account')}</button>
        </div>
      </form>
    </Modal>
  );
};

