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
import { Modal } from './components/Modal';
import { SpiceModal } from './components/SpiceModal';
import { ExtrasModal } from './components/ExtrasModal';
import { AddToCartToast } from './components/AddToCartToast';
import { DeliveryAddressModal } from './components/DeliveryAddressModal';
import { fetchJson, getAuthToken } from './lib/api';
import { UserAuthModal } from './components/UserAuthModal';

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
  // Order details state
  const [pickupDate, setPickupDate] = useState('Today');
  const [pickupTime, setPickupTime] = useState('10:00 AM');
  const readyAt = React.useMemo(() => {
    try {
      const base = new Date();
      if (pickupDate === 'Tomorrow') base.setDate(base.getDate() + 1);
      const [time, mod] = pickupTime.split(' ');
      const [h, m] = time.split(':');
      let hour = Number(h);
      if (mod === 'PM' && hour < 12) hour += 12;
      if (mod === 'AM' && hour === 12) hour = 0;
      base.setHours(hour, Number(m) || 0, 0, 0);
      return base.toISOString();
    } catch { return null; }
  }, [pickupDate, pickupTime]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locations, setLocations] = useState([]);
  const [cities, setCities] = useState([]);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);

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
    } else {
      setOrderDetailsOpen(true);
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

  // Load pickup locations for popup
  useEffect(() => {
    let cancelled = false;
    async function loadLocations() {
      try {
        const list = await fetchJson(`/api/shop/${siteSlug}/locations`);
        if (!cancelled) setLocations(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setLocations([]);
      }
    }
    async function loadCities() {
      try {
        const list = await fetchJson(`/api/shop/${siteSlug}/cities`);
        if (!cancelled) setCities(Array.isArray(list) ? list : []);
      } catch { if (!cancelled) setCities([]); }
    }
    loadLocations();
    loadCities();
    return () => { cancelled = true; };
  }, [siteSlug]);

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

  const addressSummary = selectedLocation ? `${selectedLocation?.address?.streetAddress?.[0] || ''}, ${selectedLocation?.address?.city || ''}` : undefined;
  const OrderTypeSelection = () => (
    <OrderDetailsBar
      orderType={state.fulfillmentType === 'delivery' ? 'Delivery' : (state.fulfillmentType === 'pickup' ? 'Takeout' : 'Select order type')}
      pickupDate={pickupDate}
      pickupTime={pickupTime}
      addressSummary={addressSummary}
      onChangeOrderType={() => setFulfillmentOpen(true)}
      onChangePickupDate={() => setOrderDetailsOpen(true)}
      onChangePickupTime={() => setOrderDetailsOpen(true)}
    />
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
        readyAt={readyAt}
      />
      <TopNav siteSlug={siteSlug} onSignIn={() => setLoginOpen(true)} />
      <main className="content">

        <div className="card order-type-card">
          <OrderTypeSelection />
        </div>

        {content}
      </main>

      <button className="cart-fab hide-desktop" onClick={() => setMobileCartOpen(true)}>
        <span style={{ fontSize: 18 }}>🛒</span>
        <span style={{ fontWeight: 800 }}>Cart ({state.items.length})</span>
      </button>

      <PrivacyPolicyModal open={privacyOpen} onAccept={handleAcceptPrivacy} />
      <FulfillmentModal open={fulfillmentOpen} onChoose={handleChooseFulfillment} />
      {/* Order Details Modal: Takeout/Delivery UI like screenshots */}
      <Modal open={orderDetailsOpen} onClose={() => setOrderDetailsOpen(false)} title="ORDER DETAILS">
        {state.fulfillmentType === 'delivery' ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="primary-btn" disabled>Delivery</button>
              <button onClick={() => setFulfillmentOpen(true)}>Takeout</button>
            </div>
            <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)' }}>
              <button className="primary-btn" style={{ background: 'transparent', border: 'none' }} onClick={() => setDeliveryModalOpen(true)}>Enter address</button>
              <button style={{ background: 'transparent', border: 'none' }} onClick={() => setDeliveryModalOpen(true)}>By location</button>
              <button style={{ background: 'transparent', border: 'none' }} onClick={() => setDeliveryModalOpen(true)}>By city</button>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {cities.length ? `Serving: ${cities.join(', ')}` : 'Delivery cities will be shown during checkout'}
            </div>
            <button className="primary-btn" onClick={() => setDeliveryModalOpen(true)}>Add delivery details</button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button className="primary-btn" disabled>Takeout</button>
              <button onClick={() => setFulfillmentOpen(true)}>Delivery</button>
            </div>
            <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
              <button className="primary-btn" style={{ background: 'transparent', border: 'none' }}>By location</button>
              <button style={{ background: 'transparent', border: 'none' }}>By city</button>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {locations.map((loc, idx) => (
                <label key={idx} className="card" style={{ padding: 12, display: 'grid', gap: 6, textAlign: 'left', cursor: 'pointer' }}>
                  <input type="radio" name="pickupLocation" checked={selectedLocation === loc} onChange={() => setSelectedLocation(loc)} />
                  <div style={{ fontWeight: 800 }}>{loc.name || 'Restaurant'}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {(loc.address?.streetAddress || []).join(' ')}, {loc.address?.city}, {loc.address?.province} {loc.address?.postalCode}
                  </div>
                </label>
              ))}
              {locations.length === 0 ? <div className="muted">No pickup locations configured.</div> : null}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>Day</span>
                <select value={pickupDate} onChange={(e) => setPickupDate(e.target.value)}>
                  <option value="Today">Today</option>
                  <option value="Tomorrow">Tomorrow</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>Pickup time</span>
                <select value={pickupTime} onChange={(e) => setPickupTime(e.target.value)}>
                  {['10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM','1:00 PM'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="primary-btn" onClick={async () => {
                try {
                  const token = getAuthToken();
                  if (!token) { setLoginOpen(true); return; }
                  if (!selectedLocation) { alert('Please choose a pickup location'); return; }
                  // Build pickup order payload
                  const payload = {
                    items: manifest.map((m) => ({ name: m.name, quantity: m.quantity, priceCents: m.priceCents || 0, size: m.size || 'small' })),
                    totalCents: manifest.reduce((s, it) => s + (it.priceCents || 0) * (it.quantity || 1), 0),
                    tipCents: 0,
                    pickup: {
                      location: selectedLocation,
                      scheduledFor: readyAt,
                    },
                  };
                  const res = await fetchJson(`/api/shop/${siteSlug}/site`).catch(() => ({}));
                  await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/shop/${siteSlug}/orders/pickup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                    body: JSON.stringify(payload),
                  }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); });
                  setOrderDetailsOpen(false);
                  try { window.location.href = `/s/${siteSlug}/orders`; } catch {}
                } catch (e) {
                  alert(e?.message || 'Failed to place pickup order');
                }
              }}>Confirm</button>
            </div>
          </div>
        )}
      </Modal>
      <DeliveryAddressModal
        open={deliveryModalOpen}
        siteSlug={siteSlug}
        onClose={() => setDeliveryModalOpen(false)}
        onConfirmed={(id) => {
          setLastDeliveryId(id);
          // After delivery order is placed, navigate to My Orders
          try { window.location.href = `/s/${siteSlug}/orders`; } catch {}
        }}
        manifest={manifest}
      />
      {lastDeliveryId ? (
        <div className="muted" style={{ textAlign: 'center', marginTop: 10, fontSize: 12 }}>Last delivery ID: {lastDeliveryId}</div>
      ) : null}
      <SpiceModal open={spiceOpen} spiceLevels={pendingProduct?.spiceLevels} onCancel={() => setSpiceOpen(false)} onConfirm={confirmSpice} />
      <ExtrasModal open={extrasOpen} groups={pendingProduct?.extraOptionGroups} onCancel={() => setExtrasOpen(false)} onConfirm={confirmExtras} />
      <AddToCartToast />
      <UserAuthModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => {
        setLoginOpen(false);
        if (!state.fulfillmentType) setFulfillmentOpen(true);
        setFulfillmentType('delivery');
        setDeliveryModalOpen(true);
      }} />
    </div>
  );
};

export const ShopApp = ({ siteSlug = 'default', initialCategoryId }) => {
  return <Main siteSlug={siteSlug} initialCategoryId={initialCategoryId} />;
};

