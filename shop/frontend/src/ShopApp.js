import React, { useEffect, useMemo, useState } from 'react';
import { useCart } from './store/CartContext';
import { CartSidebar } from './components/CartSidebar';
import { CategoryGrid } from './components/CategoryGrid';
// import { StoreHeader } from './components/StoreHeader';
import { TopNav } from './components/TopNav';
import { OrderDetailsBar } from './components/OrderDetailsBar';
import { ProductList } from './components/ProductList';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
import { FulfillmentModal } from './components/FulfillmentModal';
import { SpiceModal } from './components/SpiceModal';
import { ExtrasModal } from './components/ExtrasModal';
import { AddToCartToast } from './components/AddToCartToast';
import { DeliveryAddressModal } from './components/DeliveryAddressModal';
import { fetchJson, getAuthToken } from './lib/api';
import { CategoryChips } from './components/CategoryChips';
import { ShopTopBar } from './components/ShopTopBar';
import { LoginModal } from './components/LoginModal';
import { StoreBanner } from './components/StoreBanner';

const Main = ({ siteSlug = 'default', initialCategoryId }) => {
  const { state, setFulfillmentType, addItem, getCartTotal } = useCart();
  const [privacyOpen, setPrivacyOpen] = useState(true);
  const [fulfillmentOpen, setFulfillmentOpen] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [allCategories, setAllCategories] = useState([]);

  const [pendingProduct, setPendingProduct] = useState(null);
  const [spiceOpen, setSpiceOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [pendingSpice, setPendingSpice] = useState(undefined);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [vegFilter, setVegFilter] = useState('all');
  const [lastDeliveryId, setLastDeliveryId] = useState(null);

  // Additional UI state brought from the alternate implementation
  const [pickupTime] = useState('10:00 AM');

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

  function handleChooseFulfillment(type) {
    setFulfillmentType(type);
    setFulfillmentOpen(false);
    if (type === 'delivery') {
      setDeliveryModalOpen(true);
    }
  }

  function startAddToCart(product) {
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

  function confirmSpice(spice) {
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

  function confirmExtras(selected) {
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
        const cats = await fetchJson(`/api/shop/${siteSlug}/categories`);
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
          vegFilter={vegFilter}
        />
      );
    }
    return <CategoryGrid onSelect={setSelectedCategory} siteSlug={siteSlug} />;
  }, [selectedCategory, siteSlug, vegFilter]);

  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const manifest = useMemo(() => {
    return state.items.map((it) => ({
      name: it.name,
      quantity: it.quantity,
      priceCents: Math.round(it.basePrice * 100),
      size: 'small',
    }));
  }, [state.items]);

  const cartTotal = getCartTotal();

  const OrderTypeSelection = () => (
    <OrderDetailsBar orderType="Select an order type" pickupDate="Today" pickupTime={pickupTime} />
  );

  return (
    <div>
      <div className="cart-backdrop hide-desktop" data-show={mobileCartOpen ? 'true' : 'false'} onClick={() => setMobileCartOpen(false)} />

      <CartSidebar
        open={mobileCartOpen}
        onClose={() => setMobileCartOpen(false)}
        onCheckout={() => {
          const hasToken = !!getAuthToken();
          if (!hasToken) {
            setLoginOpen(true);
            return;
          }
          if (!state.fulfillmentType) setFulfillmentOpen(true);
          setFulfillmentType('delivery');
          setDeliveryModalOpen(true);
        }}
      />
      <TopNav siteSlug={siteSlug} onSignIn={() => setLoginOpen(true)} />
      <main className="content">

        <div className="card order-type-card">
          <OrderTypeSelection />
        </div>

        <ShopTopBar vegFilter={vegFilter} onVegChange={setVegFilter} />
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
              const hasToken = !!getAuthToken();
              if (!hasToken) { setLoginOpen(true); return; }
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

      <div className="order-summary-bar">
        <div className="order-empty">
          {state.items.length === 0 ? 'Your order is empty' : `${state.items.length} items in cart`}
        </div>
        <div className="order-total">
          <div className="total-label">Subtotal</div>
          <div className="total-amount">${(cartTotal || 0).toFixed(2)}</div>
        </div>
        <button
          className="confirm-btn"
          disabled={state.items.length === 0}
          onClick={() => {
            const hasToken = !!getAuthToken();
            if (!hasToken) {
              setLoginOpen(true);
              return;
            }
            if (!state.fulfillmentType) setFulfillmentOpen(true);
          }}
        >
          Confirm →
        </button>
      </div>

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
        onConfirmed={(id) => setLastDeliveryId(id)}
        manifest={manifest}
      />
      {lastDeliveryId ? (
        <div className="muted" style={{ textAlign: 'center', marginTop: 10, fontSize: 12 }}>Last delivery ID: {lastDeliveryId}</div>
      ) : null}
      <SpiceModal open={spiceOpen} spiceLevels={pendingProduct?.spiceLevels} onCancel={() => setSpiceOpen(false)} onConfirm={confirmSpice} />
      <ExtrasModal open={extrasOpen} groups={pendingProduct?.extraOptionGroups} onCancel={() => setExtrasOpen(false)} onConfirm={confirmExtras} />
      <AddToCartToast />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => {
        setLoginOpen(false);
        if (!state.fulfillmentType) setFulfillmentOpen(true);
        setFulfillmentType('delivery');
        setDeliveryModalOpen(true);
      }} mode="user" />
    </div>
  );
};

export const ShopApp = ({ siteSlug = 'default', initialCategoryId }) => {
  return <Main siteSlug={siteSlug} initialCategoryId={initialCategoryId} />;
};

