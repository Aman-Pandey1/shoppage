import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { fetchJson, getCurrentUser, logout, resolveAssetUrl } from '../lib/api';
import { useNavigate } from 'react-router-dom';

export const TopNav = ({ siteSlug = 'default', onSignIn, onOpenCart, cartCount = 0, isCartOpen = false }) => {
  const [site, setSite] = React.useState({ name: 'Store' });
  const [primaryLocation, setPrimaryLocation] = React.useState(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [windowWidth, setWindowWidth] = React.useState(window.innerWidth);
  const user = getCurrentUser();
  const navigate = useNavigate();

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchJson(`/api/shop/${siteSlug}/site`);
        if (!cancelled) {
          setSite(data || {});
          try {
            const base = (data && data.brandColor) ? data.brandColor : '#0ea5e9';
            document.documentElement.style.setProperty('--primary', base);
            document.documentElement.style.setProperty('--primary-600', base);
            const rgba = (hex, a) => {
              const h = String(hex || '').replace('#','');
              if (!/^([\da-fA-F]{6}|[\da-fA-F]{3})$/.test(h)) return `rgba(14,165,233,${a})`;
              const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
              const bigint = parseInt(full, 16);
              const r = (bigint >> 16) & 255;
              const g = (bigint >> 8) & 255;
              const b = bigint & 255;
              return `rgba(${r},${g},${b},${a})`;
            };
            document.documentElement.style.setProperty('--primary-alpha-04', rgba(base, 0.04));
            document.documentElement.style.setProperty('--primary-alpha-08', rgba(base, 0.08));
            document.documentElement.style.setProperty('--primary-alpha-12', rgba(base, 0.12));
            document.documentElement.style.setProperty('--primary-alpha-18', rgba(base, 0.18));
            document.documentElement.style.setProperty('--primary-alpha-22', rgba(base, 0.22));
            document.documentElement.style.setProperty('--primary-alpha-25', rgba(base, 0.25));
          } catch {}
        }
      } catch {}
    }
    async function loadPrimaryLocation() {
      try {
        const list = await fetchJson(`/api/shop/${siteSlug}/locations`);
        if (!cancelled) {
          const arr = Array.isArray(list) ? list : [];
          setPrimaryLocation(arr[0] || null);
        }
      } catch {
        if (!cancelled) setPrimaryLocation(null);
      }
    }
    load();
    loadPrimaryLocation();
    return () => { cancelled = true; };
  }, [siteSlug]);

  // Track window width for responsive behavior
  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const name = site?.name || 'Store';
  const tagline = (typeof site?.tagline === 'string') ? site.tagline : '';
  const supportWhatsappPhone = (typeof site?.supportWhatsappPhone === 'string' ? site.supportWhatsappPhone : '').trim();
  // Prefer explicitly configured support number; fallback to pickup phone if needed
  const supportPhone = (supportWhatsappPhone || (typeof site?.pickup?.phone === 'string' ? site.pickup.phone.trim() : ''));
  const telHref = React.useMemo(() => supportPhone ? `tel:${String(supportPhone).replace(/[^+\d]/g, '')}` : '', [supportPhone]);
  const addressLine = React.useMemo(() => {
    try {
      if (!primaryLocation || !primaryLocation.address) return '';
      const parts = [
        ...(Array.isArray(primaryLocation.address.streetAddress) ? primaryLocation.address.streetAddress : []),
        primaryLocation.address.city,
        primaryLocation.address.province,
        primaryLocation.address.postalCode,
      ].filter(Boolean);
      return parts.join(', ');
    } catch { return ''; }
  }, [primaryLocation]);
  const rawLogoUrl = site?.logoUrl || '';
  const logoLinkUrl = (typeof site?.logoLinkUrl === 'string' ? site.logoLinkUrl : '').trim();
  const resolvedBackendLogo = React.useMemo(() => resolveAssetUrl(rawLogoUrl), [rawLogoUrl]);
  const logoCandidates = React.useMemo(() => {
    try {
      const list = [];
      // 1) Backend absolute URL (API_BASE_URL + relative or passthrough for absolute)
      if (resolvedBackendLogo) list.push(resolvedBackendLogo);
      // 2) Same-origin relative URL fallback (helps when backend is reverse-proxied)
      if (rawLogoUrl && typeof window !== 'undefined') {
        const path = rawLogoUrl.startsWith('/') ? rawLogoUrl : `/${rawLogoUrl}`;
        const sameOrigin = `${window.location.origin}${path}`;
        if (!list.includes(sameOrigin)) list.push(sameOrigin);
      }
      return list;
    } catch { return resolvedBackendLogo ? [resolvedBackendLogo] : []; }
  }, [resolvedBackendLogo, rawLogoUrl]);
  const initials = React.useMemo(() => {
    if (!user?.email) return 'FR';
    const base = (user?.email?.split('@')[0] || '').replace(/[^A-Za-z]/g, '');
    return base.slice(0, 2).toUpperCase() || 'FR';
  }, [user?.email]);

  // Track broken logo URLs to show graceful fallback and reset when URL changes
  const [logoIndex, setLogoIndex] = React.useState(0);
  React.useEffect(() => { setLogoIndex(0); }, [logoCandidates.map(String).join('|')]);

  // Check if screen is desktop (1024px and above)
  const isDesktop = windowWidth >= 1024;

  return (
    <div className="top-nav" data-menu-open={menuOpen ? 'true' : 'false'} role="banner">
      <div className="top-nav__inner">
        <div className="brand" aria-label="Store brand">
          {logoLinkUrl ? (
            <button
              className="brand__back"
              aria-label="Back"
              title="Back"
              onClick={() => {
                if (logoLinkUrl.startsWith('http')) { window.location.href = logoLinkUrl; return; }
                try { navigate(logoLinkUrl); } catch { window.location.href = logoLinkUrl; }
              }}
            >
              <ArrowLeft size={18} />
            </button>
          ) : null}
          <a
            className="brand__logo"
            aria-label="Home"
            href={logoLinkUrl || undefined}
            onClick={(e) => {
              if (!logoLinkUrl) return; // no link configured
              if (logoLinkUrl.startsWith('http')) return; // let browser handle external link
              e.preventDefault();
              try { navigate(logoLinkUrl); } catch { window.location.href = logoLinkUrl; }
            }}
            style={{ cursor: logoLinkUrl ? 'pointer' : 'default' }}
          >
            {logoCandidates.length > 0 && logoIndex < logoCandidates.length ? (
              <img
                src={logoCandidates[logoIndex]}
                alt="logo"
                onError={() => setLogoIndex((i) => i + 1)}
              />
            ) : (
              <span>🍽️</span>
            )}
          </a>
          <div className="brand__text">
            <div className="brand__name">{name}</div>
            {tagline ? (
              <div className="brand__tagline hide-mobile">{tagline}</div>
            ) : null}
            {/* Address intentionally hidden per design request */}
          </div>
        </div>
        {/* On mobile, when the cart is open we only show "Cart" at top */}
        <div className="nav-title">{isCartOpen ? 'Cart' : 'Order Online'}</div>

        <div className="actions" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
          {supportPhone ? (
            <a
              href={telHref}
              aria-label="Call support"
              title={`Call ${supportPhone}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 999,
                // Ensure strong contrast on red header
                border: '1px solid rgba(255,255,255,0.65)',
                background: 'rgba(255,255,255,0.10)',
                fontSize: 12,
                textDecoration: 'none',
                color: '#fff',
                fontWeight: 700,
              }}
            >
              <span role="img" aria-label="Call">📞</span>
              <span className="hide-mobile">{supportPhone}</span>
            </a>
          ) : null}
          {/* Cart button - hidden on desktop, visible on mobile and tablet */}
          {!isDesktop && (
            <button
              className="cart-header-btn"
              aria-label="Open cart"
              onClick={() => { if (typeof onOpenCart === 'function') onOpenCart(); }}
              title="Cart"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                padding: '8px'
              }}
            >
              <span role="img" aria-label="cart">🛒</span>
              {Number(cartCount) > 0 ? (
                <span 
                  className="cart-header-badge" 
                  aria-label={`Items in cart: ${cartCount}`}
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    background: '#ff4444',
                    color: 'white',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    fontSize: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold'
                  }}
                >
                  {cartCount}
                </span>
              ) : null}
            </button>
          )}
          
          <button className="profile-chip hide-mobile" aria-label="Account" onClick={() => setMenuOpen((v) => !v)}>
            <span>{initials}</span>
          </button>
          {!user ? (
            <button className="signin-btn hide-mobile" onClick={onSignIn}>Sign in</button>
          ) : null}
          {menuOpen ? (
            <div 
              className="card" 
              style={{ 
                position: 'absolute', 
                right: 0, 
                top: 'calc(100% + 8px)', 
                padding: 8, 
                borderRadius: 12, 
                minWidth: 220, 
                zIndex: 210,
                background: 'white',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                border: '1px solid #e2e8f0'
              }} 
              onMouseLeave={() => setMenuOpen(false)}
            >
              <div style={{ padding: '6px 10px', fontWeight: 700 }}>{user?.email || 'Account'}</div>
              <button 
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  marginTop: 4, 
                  padding: '6px 10px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer'
                }} 
                onClick={() => { setMenuOpen(false); navigate(`/s/${siteSlug}/orders`); }}
              >
                My Orders
              </button>
              {!user ? (
                <button 
                  style={{ 
                    width: '100%', 
                    textAlign: 'left', 
                    padding: '6px 10px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer'
                  }} 
                  onClick={() => { setMenuOpen(false); onSignIn && onSignIn(); }}
                >
                  Login / Register
                </button>
              ) : (
                <button 
                  style={{ 
                    width: '100%', 
                    textAlign: 'left', 
                    padding: '6px 10px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer'
                  }} 
                  onClick={() => { logout(); setMenuOpen(false); window.location.reload(); }}
                >
                  Logout
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Add CSS for responsive behavior */}
      <style>{`
        @media (min-width: 1024px) {
          .cart-header-btn {
            display: none !important;
          }
        }
        
        @media (max-width: 1023px) {
          .cart-header-btn {
            display: flex !important;
          }
          
          .hide-mobile {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};