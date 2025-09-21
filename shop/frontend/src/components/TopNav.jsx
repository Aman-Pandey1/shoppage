import React from 'react';
import { fetchJson, getCurrentUser, logout } from '../lib/api';
import { useNavigate } from 'react-router-dom';

export const TopNav = ({ siteSlug = 'default', onSignIn }) => {
  const [site, setSite] = React.useState({ name: 'Store' });
  const [menuOpen, setMenuOpen] = React.useState(false);
  const user = getCurrentUser();
  const navigate = useNavigate();

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchJson(`/api/shop/${siteSlug}/site`);
        if (!cancelled) setSite(data || {});
      } catch {}
    }
    load();
    return () => { cancelled = true; };
  }, [siteSlug]);

  const name = site?.name || 'Store';
  const initials = React.useMemo(() => {
    if (!user?.email) return 'FR';
    const base = (user?.email?.split('@')[0] || '').replace(/[^A-Za-z]/g, '');
    return base.slice(0, 2).toUpperCase() || 'FR';
  }, [user?.email]);

  return (
    <div className="top-nav" role="banner">
      <div className="top-nav__inner">
        <div className="brand" aria-label="Store brand">
          <div className="brand__logo" aria-hidden>
            {site?.logoUrl ? (
              <img src={site.logoUrl} alt="" />
            ) : (
              <span>🍽️</span>
            )}
          </div>
          <div className="brand__text">
            <div className="brand__name">{name}</div>
            <div className="brand__tagline">Sweets, Catering & Take out</div>
          </div>
        </div>

        <div className="nav-title">ONLINE ORDERING</div>

        <div className="actions" style={{ position: 'relative' }}>
          <button className="profile-chip" aria-label="Account" onClick={() => setMenuOpen((v) => !v)}>
            <span>{initials}</span>
          </button>
          {!user ? (
            <button className="signin-btn" onClick={onSignIn}>Sign in</button>
          ) : null}
          {menuOpen ? (
            <div className="card" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', padding: 8, borderRadius: 12, minWidth: 220 }} onMouseLeave={() => setMenuOpen(false)}>
              <div style={{ padding: '6px 10px', fontWeight: 700 }}>{user?.email || 'Account'}</div>
              <button style={{ width: '100%', textAlign: 'left', marginTop: 4 }} onClick={() => { setMenuOpen(false); navigate(`/s/${siteSlug}/orders`); }}>My Orders</button>
              {!user ? (
                <button style={{ width: '100%', textAlign: 'left' }} onClick={() => { setMenuOpen(false); onSignIn && onSignIn(); }}>Login / Register</button>
              ) : (
                <button style={{ width: '100%', textAlign: 'left' }} onClick={() => { logout(); setMenuOpen(false); window.location.reload(); }}>Logout</button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

