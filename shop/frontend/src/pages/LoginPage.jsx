import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { login } from '../lib/api';
import { Lock } from 'lucide-react';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      await login(email, password);
      const redirectTo = location.state?.from?.pathname || '/dashboard';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="card animate-popIn" style={{ width: 'min(92vw, 440px)', padding: 18, borderRadius: 'var(--radius)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Lock size={24} />
          <h2 style={{ margin: 0 }}>Admin Login</h2>
        </div>
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
          <button className="primary-btn" disabled={loading} style={{ marginTop: 6 }}>
            {loading ? 'Logging in…' : 'Login'}
          </button>
        </form>
        <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          Default admin: admin@example.com / admin123
        </div>
        <div style={{ marginTop: 12, fontSize: 14 }}>
          <Link to="/">← Back to shop</Link>
        </div>
      </div>
    </div>
  );
};

