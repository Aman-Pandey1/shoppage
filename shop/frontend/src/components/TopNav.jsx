import React from 'react';
import { fetchJson } from '../lib/api';

export const TopNav = ({ siteSlug = 'default', onSignIn }) => {
  const [site, setSite] = React.useState({ name: 'Store' });

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

        <div className="actions">
          <button className="profile-chip" aria-label="Account">
            <span>FR</span>
          </button>
          <button className="signin-btn" onClick={onSignIn}>Sign in</button>
        </div>
      </div>
    </div>
  );
};

