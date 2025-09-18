import React from 'react';
import { CartProvider } from '../store/CartContext';
import { ShopApp } from '../ShopAppp';
import { fetchJson } from '../lib/api';

export const ShopHomePage = () => {
  const [resolvedSlug, setResolvedSlug] = React.useState();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState();

  React.useEffect(() => {
    let cancelled = false;
    async function resolveHost() {
      try {
        setLoading(true);
        const data = await fetchJson(`/api/shop/host-site`);
        if (!cancelled) setResolvedSlug(data.slug || 'default');
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Failed to resolve site');
          setResolvedSlug('default');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    resolveHost();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div>Loading shop…</div>;
  if (error) return <div style={{ color: 'red' }}>Failed to load site: {error}</div>;

  const slug = resolvedSlug || 'default';
  const storageKey = `shop_cart_state_v1:${slug}`;
  return (
    <CartProvider storageKey={storageKey}>
      <ShopApp siteSlug={slug} />
    </CartProvider>
  );
};

