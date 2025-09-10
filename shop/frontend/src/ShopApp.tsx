import React, { useEffect, useMemo, useState } from 'react';
import { useCart } from './store/CartContext';
import { CartSidebar } from './components/CartSidebar';
import { CategoryGrid } from './components/CategoryGrid';
import { StoreHeader } from './components/StoreHeader';
import { ProductList } from './components/ProductList';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
import { FulfillmentModal } from './components/FulfillmentModal';
import { SpiceModal } from './components/SpiceModal';
import { ExtrasModal } from './components/ExtrasModal';
import { Link } from 'react-router-dom';
import { AddToCartToast } from './components/AddToCartToast';
import { DeliveryAddressModal } from './components/DeliveryAddressModal';
import { fetchJson } from './lib/api';
import type { Category, Product, SelectedOption } from './types';
import { CategoryChips } from './components/CategoryChips';

const Main: React.FC<{ siteSlug?: string; initialCategoryId?: string }> = (
  { siteSlug = 'default', initialCategoryId }: { siteSlug?: string; initialCategoryId?: string }
) => {
  const { state, setFulfillmentType, addItem } = useCart();
  const [privacyOpen, setPrivacyOpen] = useState(true);
  const [fulfillmentOpen, setFulfillmentOpen] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [spiceOpen, setSpiceOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [pendingSpice, setPendingSpice] = useState<string | undefined>(undefined);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [lastDeliveryId, setLastDeliveryId] = useState<string | null>(null);

  useEffect(() => {
    const privacyAccepted = localStorage.getItem('privacyAccepted_v1');
    if (privacyAccepted) {
      setPrivacyOpen(false);
      if (!state.fulfillmentType) setFulfillmentOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!privacyOpen && !state.fulfillmentType) {
      setFulfillmentOpen(true);
    }
  }, [privacyOpen, state.fulfillmentType]);

  function handleAcceptPrivacy() {
    localStorage.setItem('privacyAccepted_v1', '1');
    setPrivacyOpen(false);
    setFulfillmentOpen(true);
  }

  function handleChooseFulfillment(type: 'pickup' | 'delivery') {
    setFulfillmentType(type);
    setFulfillmentOpen(false);
    if (type === 'delivery') {
      setDeliveryModalOpen(true);
    }
  }

  function startAddToCart(product: Product) {
    setPendingProduct(product);
    if (product.spiceLevels && product.spiceLevels.length > 0) {
      setSpiceOpen(true);
    } else if (product.extraOptionGroups && product.extraOptionGroups.length > 0) {
      setExtrasOpen(true);
    } else {
      addItem({ product });
      setPendingProduct(null);
    }
  }

  function confirmSpice(spice?: string) {
    setPendingSpice(spice);
    setSpiceOpen(false);
    if (pendingProduct && pendingProduct.extraOptionGroups && pendingProduct.extraOptionGroups.length > 0) {
      setExtrasOpen(true);
    } else if (pendingProduct) {
      addItem({ product: pendingProduct, spiceLevel: spice });
      setPendingProduct(null);
      setPendingSpice(undefined);
    }
  }

  function confirmExtras(selected: SelectedOption[]) {
    setExtrasOpen(false);
    if (pendingProduct) {
      addItem({ product: pendingProduct, spiceLevel: pendingSpice, selectedOptions: selected });
    }
    setPendingProduct(null);
    setPendingSpice(undefined);
  }

  // Load categories and preselect a category if provided via route
  useEffect(() => {
    let cancelled = false;
    async function preselect() {
      try {
        const cats = await fetchJson<Category[]>(`/api/shop/${siteSlug}/categories`);
        if (cancelled) return;
        setAllCategories(cats);
        if (initialCategoryId) {
          const found = cats.find((c) => String(c._id) === String(initialCategoryId));
          if (found) setSelectedCategory(found);
        }
      } catch {}
    }
    preselect();
    return () => { cancelled = true; };
  }, [initialCategoryId, siteSlug]);

  const content = useMemo(() => {
    if (selectedCategory) {
      return (
        <ProductList
          category={selectedCategory}
          siteSlug={siteSlug}
          onAdd={startAddToCart}
          onBack={() => setSelectedCategory(null)}
        />
      );
    }
    return <CategoryGrid onSelect={setSelectedCategory} siteSlug={siteSlug} />;
  }, [selectedCategory, siteSlug]);

  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const manifest = useMemo(() => {
    return state.items.map((it) => ({
      name: it.name,
      quantity: it.quantity,
      priceCents: Math.round(it.basePrice * 100),
      size: 'small' as 'small',
    }));
  }, [state.items]);

  return (
    <div>
      {/* Backdrop for mobile drawer */}
      <div className="cart-backdrop hide-desktop" data-show={mobileCartOpen ? 'true' : 'false'} onClick={() => setMobileCartOpen(false)} />

      <CartSidebar
        open={mobileCartOpen}
        onClose={() => setMobileCartOpen(false)}
        onCheckout={() => {
          if (!state.fulfillmentType) setFulfillmentOpen(true);
          // Auto-select delivery for checkout
          setFulfillmentType('delivery');
          setDeliveryModalOpen(true);
        }}
      />
      <main className="content">
        <StoreHeader siteSlug={siteSlug} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 style={{ marginTop: 0 }}>Shop</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link to="/login">Admin Login</Link>
            <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              <span>Items: {state.items.length}</span>
            </div>
          </div>
        </div>
        <section className="card" style={{ padding: 10, marginBottom: 10 }}>
          <CategoryChips
            categories={allCategories}
            currentId={selectedCategory?._id}
            onSelect={(c) => setSelectedCategory(c)}
          />
        </section>
        <div className="hide-desktop" style={{ marginBottom: 10 }}>
          <button
            className="primary-btn"
            onClick={() => {
              if (!state.fulfillmentType) setFulfillmentOpen(true);
              setFulfillmentType('delivery');
              setDeliveryModalOpen(true);
            }}
          >
            Checkout
          </button>
        </div>
        {content}
      </main>

      {/* Mobile FAB */}
      <button className="cart-fab hide-desktop" onClick={() => setMobileCartOpen(true)}>
        <span style={{ fontSize: 18 }}>🛒</span>
        <span style={{ fontWeight: 800 }}>Cart ({state.items.length})</span>
      </button>

      <PrivacyPolicyModal open={privacyOpen} onAccept={handleAcceptPrivacy} />
      <FulfillmentModal open={fulfillmentOpen} onChoose={handleChooseFulfillment} />
      <DeliveryAddressModal
        open={deliveryModalOpen}
        siteSlug={siteSlug}
        onClose={() => setDeliveryModalOpen(false)}
        onConfirmed={(id: string) => setLastDeliveryId(id)}
        manifest={manifest}
      />
      {lastDeliveryId ? (
        <div className="muted" style={{ textAlign: 'center', marginTop: 10, fontSize: 12 }}>Last delivery ID: {lastDeliveryId}</div>
      ) : null}
      <SpiceModal open={spiceOpen} spiceLevels={pendingProduct?.spiceLevels} onCancel={() => setSpiceOpen(false)} onConfirm={confirmSpice} />
      <ExtrasModal open={extrasOpen} groups={pendingProduct?.extraOptionGroups} onCancel={() => setExtrasOpen(false)} onConfirm={confirmExtras} />
      {/* Toast for add-to-cart */}
      <AddToCartToast />
      {/* Login moved to dedicated /login route */}
    </div>
  );
};

export const ShopApp: React.FC<{ siteSlug?: string; initialCategoryId?: string }> = (
  { siteSlug = 'default', initialCategoryId }: { siteSlug?: string; initialCategoryId?: string }
) => {
  return <Main siteSlug={siteSlug} initialCategoryId={initialCategoryId} />;
};