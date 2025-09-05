import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CartSidebar } from '../components/CartSidebar';
import { CategoryGrid } from '../components/CategoryGrid';
import { ProductList } from '../components/ProductList';
import { PrivacyPolicyModal } from '../components/PrivacyPolicyModal';
import { FulfillmentModal } from '../components/FulfillmentModal';
import { SpiceModal } from '../components/SpiceModal';
import { ExtrasModal } from '../components/ExtrasModal';
import { AddToCartToast } from '../components/AddToCartToast';
import type { Category, Product, SelectedOption } from '../types';
import { useCart } from '../store/CartContext';

export const ShopBySlugView: React.FC<{ siteSlug: string }> = ({ siteSlug }) => {
  const { state, setFulfillmentType, addItem } = useCart();
  const [privacyOpen, setPrivacyOpen] = useState(true);
  const [fulfillmentOpen, setFulfillmentOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [spiceOpen, setSpiceOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [pendingSpice, setPendingSpice] = useState<string | undefined>(undefined);

  const content = useMemo(() => {
    if (selectedCategory) {
      return (
        <ProductList
          category={selectedCategory}
          onAdd={(product) => setPendingProduct(product)}
          onBack={() => setSelectedCategory(null)}
        />
      );
    }
    return <CategoryGrid onSelect={setSelectedCategory} />;
  }, [selectedCategory]);

  return (
    <div>
      <div className="cart-backdrop hide-desktop" data-show={'false'} />
      <CartSidebar open={false} onClose={() => {}} />
      <main className="content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 style={{ marginTop: 0 }}>Shop: {siteSlug}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link to="/login">Admin Login</Link>
            <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              <span>Items: {state.items.length}</span>
            </div>
          </div>
        </div>
        {content}
      </main>
      <PrivacyPolicyModal open={privacyOpen} onAccept={() => setPrivacyOpen(false)} />
      <FulfillmentModal open={fulfillmentOpen} onChoose={(type) => { setFulfillmentType(type); setFulfillmentOpen(false); }} />
      <SpiceModal open={spiceOpen} spiceLevels={pendingProduct?.spiceLevels} onCancel={() => setSpiceOpen(false)} onConfirm={(s) => setPendingSpice(s)} />
      <ExtrasModal open={extrasOpen} groups={pendingProduct?.extraOptionGroups} onCancel={() => setExtrasOpen(false)} onConfirm={() => {}} />
      <AddToCartToast />
    </div>
  );
};

