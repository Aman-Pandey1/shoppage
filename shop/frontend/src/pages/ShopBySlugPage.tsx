import React from 'react';
import { useParams } from 'react-router-dom';
import { CartProvider } from '../store/CartContext';
import { ShopApp } from '../ShopApp';
import { fetchJson } from '../lib/api';

export const ShopBySlugPage: React.FC = () => {
  const params = useParams();
  const paramSlug = params.siteSlug;
  const paramCategoryId = params.categoryId as string | undefined;
  const [resolvedSlug, setResolvedSlug] = React.useState<string | undefined>(paramSlug);
  const [loading, setLoading] = React.useState<boolean>(!paramSlug);
  const [error, setError] = React.useState<string | undefined>();

  React.useEffect(() => {
    let cancelled = false;
    async function resolveHost() {
      try {
        setLoading(true);
        const data = await fetchJson<{ slug: string }>(`/api/shop/host-site`);
        if (!cancelled) setResolvedSlug(data.slug || 'default');
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || 'Failed to resolve site');
          setResolvedSlug('default');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (!paramSlug) resolveHost();
    else {
      setResolvedSlug(paramSlug);
      setLoading(false);
      setError(undefined);
    }
    return () => { cancelled = true; };
  }, [paramSlug]);

  if (loading) return <div>Loading shop…</div>;
  if (error) {
    return <div style={{ color: 'red' }}>Failed to load site: {error}</div>;
  }
  const slug = resolvedSlug || 'default';
  const storageKey = `shop_cart_state_v1:${slug}`;
  return (
    <CartProvider storageKey={storageKey}>
      <ShopApp siteSlug={slug} initialCategoryId={paramCategoryId} />
    </CartProvider>
  );
};

