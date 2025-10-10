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
import { VariantModal } from './components/VariantModal';
import { AddToCartToast } from './components/AddToCartToast';
import { DeliveryAddressModal } from './components/DeliveryAddressModal';
import { fetchJson, getAuthToken, postJson } from './lib/api';
import { UserAuthModal } from './components/UserAuthModal';

const Main = ({ siteSlug = 'default', initialCategoryId }) => {
  const { state, setFulfillmentType, addItem, getCartTotal } = useCart();
  const [privacyOpen, setPrivacyOpen] = useState(true);
  const [fulfillmentOpen, setFulfillmentOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [allCategories, setAllCategories] = useState([]);
  const [pendingProduct, setPendingProduct] = useState(null);
  const [pendingQuantity, setPendingQuantity] = useState(1);
  const [spiceOpen, setSpiceOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [variantOpen, setVariantOpen] = useState(false);
  const [pendingSpice, setPendingSpice] = useState(undefined);
  const [pendingVariant, setPendingVariant] = useState(null);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [vegFilter, setVegFilter] = useState('all');
  const [lastDeliveryId, setLastDeliveryId] = useState(null);
  const [deliveryAddressSummary, setDeliveryAddressSummary] = useState('');
  const [orderError, setOrderError] = useState('');
  const [pickupPaymentMethod, setPickupPaymentMethod] = useState('online'); // 'online' | 'cod'

  // Additional UI state brought from the alternate implementation
  // Order details state
  const [pickupDate, setPickupDate] = useState(''); // YYYY-MM-DD
  const [pickupTime, setPickupTime] = useState(''); // e.g., 10:00 AM
  const [hours, setHours] = useState(null);
  const [dateOptions, setDateOptions] = useState([]);
  const [timeOptions, setTimeOptions] = useState([]);
  const readyAt = React.useMemo(() => {
    try {
      if (!pickupDate || !pickupTime) return null;
      const [yr, mo, dy] = pickupDate.split('-').map(Number);
      const base = new Date(yr, (mo || 1) - 1, dy || 1);
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
  const [selectedPickupCity, setSelectedPickupCity] = useState('All');
  const [pickupTab, setPickupTab] = useState('location'); // address | location | city

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
    // Close the selection modal only; do not redirect to payment/details here.
    // The selection should simply update the header bar. User proceeds from cart.
    setFulfillmentOpen(false);
    setOrderDetailsOpen(false);
    setDeliveryModalOpen(false);
  }

  function startAddToCart(product, quantity = 1) {
    setPendingProduct(product);
    setPendingQuantity(Math.max(1, Math.min(99, Number(quantity) || 1)));
    if (Array.isArray(product?.variants) && product.variants.length > 0) {
      setVariantOpen(true);
    } else if (product.spiceLevels && product.spiceLevels.length > 0) {
      setSpiceOpen(true);
    } else if (product.extraOptionGroups && product.extraOptionGroups.length > 0) {
      setExtrasOpen(true);
    } else {
      addItem({ product, quantity: Math.max(1, Math.min(99, Number(quantity) || 1)) });
      setPendingProduct(null);
      setPendingQuantity(1);
      // If pickup is selected, open the pickup order details popup
      if (state.fulfillmentType === 'pickup') {
        setOrderDetailsOpen(true);
      }
    }
  }

  function confirmVariant(variant) {
    setPendingVariant(variant || null);
    setVariantOpen(false);
    if (pendingProduct && pendingProduct.spiceLevels && pendingProduct.spiceLevels.length > 0) {
      setSpiceOpen(true);
    } else if (pendingProduct && pendingProduct.extraOptionGroups && pendingProduct.extraOptionGroups.length > 0) {
      setExtrasOpen(true);
    } else if (pendingProduct) {
      addItem({ product: pendingProduct, variant, spiceLevel: undefined, quantity: pendingQuantity });
      if (state.fulfillmentType === 'pickup') {
        setOrderDetailsOpen(true);
      }
      setPendingProduct(null);
      setPendingVariant(null);
      setPendingQuantity(1);
    }
  }

  function confirmSpice(spice, quantityFromModal) {
    const confirmedQty = Math.max(1, Math.min(99, Number(quantityFromModal || pendingQuantity) || 1));
    setPendingSpice(spice);
    setPendingQuantity(confirmedQty);
    setSpiceOpen(false);
    if (pendingProduct && pendingProduct.extraOptionGroups && pendingProduct.extraOptionGroups.length > 0) {
      setExtrasOpen(true);
    } else if (pendingProduct) {
      addItem({ product: pendingProduct, variant: pendingVariant || undefined, spiceLevel: spice, quantity: confirmedQty });
      if (state.fulfillmentType === 'pickup') {
        setOrderDetailsOpen(true);
      }
      setPendingProduct(null);
      setPendingSpice(undefined);
      setPendingVariant(null);
      setPendingQuantity(1);
    }
  }

  function confirmExtras(selected) {
    setExtrasOpen(false);
    if (pendingProduct) {
      addItem({ product: pendingProduct, variant: pendingVariant || undefined, spiceLevel: pendingSpice, selectedOptions: selected, quantity: pendingQuantity });
      if (state.fulfillmentType === 'pickup') {
        setOrderDetailsOpen(true);
      }
    }
    setPendingProduct(null);
    setPendingSpice(undefined);
    setPendingVariant(null);
    setPendingQuantity(1);
  }

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
        if (!cancelled) {
          const arr = Array.isArray(list) ? list : [];
          setLocations(arr);
          // Respect previously chosen location if stored; do not auto-pick first
          try {
            const saved = localStorage.getItem('selectedPickupIndex');
            const savedIdx = Number(saved);
            if (Number.isFinite(savedIdx) && savedIdx >= 0 && savedIdx < arr.length) {
              setSelectedLocation(arr[savedIdx]);
            } else if (!selectedLocation && arr.length === 1) {
              setSelectedLocation(arr[0]);
              localStorage.setItem('selectedPickupIndex', '0');
            }
          } catch {}
        }
      } catch {
        if (!cancelled) setLocations([]);
      }
    }
    async function loadCities() {
      try {
        const list = await fetchJson(`/api/shop/${siteSlug}/cities`);
        if (!cancelled) {
          setCities(Array.isArray(list) ? list : []);
          // Ensure default tab + city are initialized so dropdowns show a value
          setSelectedPickupCity('All');
        }
      } catch { if (!cancelled) setCities([]); }
    }
    loadLocations();
    loadCities();
    return () => { cancelled = true; };
  }, [siteSlug]);

  // Load site opening hours
  useEffect(() => {
    let cancelled = false;
    async function loadHours() {
      try {
        const data = await fetchJson(`/api/shop/${siteSlug}/hours`);
        if (!cancelled) setHours(data);
      } catch {
        if (!cancelled) setHours(null);
      }
    }
    loadHours();
    return () => { cancelled = true; };
  }, [siteSlug]);

  // Compute date options (today + next 6 days, respecting closed days)
  useEffect(() => {
    function formatDateLabel(date, isToday) {
      const weekday = date.toLocaleDateString([], { weekday: 'long' });
      const month = date.toLocaleDateString([], { month: 'short' });
      const day = date.getDate();
      if (isToday) return `Today (${weekday}, ${month} ${day})`;
      return `${weekday} (${month} ${day})`;
    }
    function dayKeyFromDate(date) {
      const idx = date.getDay(); // 0=Sun
      return ['sun','mon','tue','wed','thu','fri','sat'][idx];
    }
    const opts = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const key = dayKeyFromDate(d);
      const cfg = hours?.[key];
      const closed = cfg?.closed === true;
      if (!closed) {
        opts.push({ value, label: formatDateLabel(d, i === 0) });
      }
    }
    setDateOptions(opts);
    if (!pickupDate && opts.length) setPickupDate(opts[0].value);
  }, [hours]);

  // Compute time options for selected date from hours (default 10:00-22:00) with 45-minute intervals
  useEffect(() => {
    function parse24h(s, fallback) {
      if (!s || !/^\d{2}:\d{2}$/.test(s)) return fallback;
      const [hh, mm] = s.split(':').map(Number);
      return { hh, mm };
    }
    function format12h(hh, mm) {
      const mod = hh >= 12 ? 'PM' : 'AM';
      const h12 = hh % 12 === 0 ? 12 : hh % 12;
      return `${h12}:${String(mm).padStart(2,'0')} ${mod}`;
    }
    function dayKeyFromDateString(iso) {
      const [yr, mo, dy] = iso.split('-').map(Number);
      const d = new Date(yr, (mo || 1)-1, dy || 1);
      return ['sun','mon','tue','wed','thu','fri','sat'][d.getDay()];
    }
    if (!pickupDate) { setTimeOptions([]); return; }
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const isTodaySelected = pickupDate === todayStr;
    const [selYr, selMo, selDy] = pickupDate.split('-').map(Number);
    const key = dayKeyFromDateString(pickupDate);
    const cfg = hours?.[key] || { open: '10:00', close: '22:00', closed: false };
    if (cfg.closed) { setTimeOptions([]); return; }
    const { hh: openH = 10, mm: openM = 0 } = parse24h(cfg.open, { hh: 10, mm: 0 });
    const { hh: closeH = 22, mm: closeM = 0 } = parse24h(cfg.close, { hh: 22, mm: 0 });
    const options = [];
    let curH = openH, curM = openM;
    while (curH < closeH || (curH === closeH && curM <= closeM)) {
      const value = format12h(curH, curM);
      let disabled = false;
      if (isTodaySelected) {
        const candidate = new Date(selYr, (selMo || 1) - 1, selDy || 1);
        candidate.setHours(curH, curM, 0, 0);
        disabled = candidate < now;
      }
      options.push({ value, label: value, disabled });
      curM += 45;
      if (curM >= 60) { curM -= 60; curH += 1; }
    }
    setTimeOptions(options);
    const firstEnabled = options.find(o => !o.disabled);
    if (!pickupTime && firstEnabled) setPickupTime(firstEnabled.value);
    if (pickupTime && options.length) {
      const cur = options.find(o => o.value === pickupTime);
      if (!cur || cur.disabled) {
        if (firstEnabled) setPickupTime(firstEnabled.value);
      }
    }
  }, [hours, pickupDate]);

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
      priceCents: Math.round(((Number(it.basePrice) || 0) + (Number(it?.variant?.priceDelta) || 0) + (Number(it?.extraCost) || 0)) * 100),
      size: (it?.variant?.label || it?.variant?.key || undefined),
      spiceLevel: it.spiceLevel,
    }));
  }, [state.items]);

  const cartTotal = getCartTotal();

  const pickupAddressSummary = selectedLocation ? `${selectedLocation?.name || 'Restaurant'} — ${(selectedLocation?.address?.streetAddress || []).join(' ')}, ${selectedLocation?.address?.city || ''}` : undefined;
  const pickupCitySummary = selectedPickupCity && selectedPickupCity !== 'All' ? selectedPickupCity : undefined;
  const addressSummary = state.fulfillmentType === 'delivery'
    ? (deliveryAddressSummary || undefined)
    : (pickupCitySummary || pickupAddressSummary);
  const filteredLocations = useMemo(() => {
    if (!selectedPickupCity || selectedPickupCity === 'All') return locations;
    return locations.filter((loc) => (loc?.address?.city || '').toLowerCase() === selectedPickupCity.toLowerCase());
  }, [locations, selectedPickupCity]);
  const OrderTypeSelection = () => (
    <OrderDetailsBar
      orderType={state.fulfillmentType === 'delivery' ? 'Delivery' : (state.fulfillmentType === 'pickup' ? 'Pickup' : 'Select order type')}
      pickupDate={pickupDate}
      pickupTime={pickupTime}
      dateOptions={dateOptions}
      timeOptions={timeOptions}
      addressSummary={addressSummary}
      locations={locations}
      selectedLocationIndex={(idx => (idx >= 0 ? idx : (() => { const s = Number(localStorage.getItem('selectedPickupIndex')); return Number.isFinite(s) ? s : undefined; })()))(locations.findIndex((l) => l === selectedLocation))}
      onChangeLocation={(idx) => {
        const chosen = locations[idx];
        setSelectedLocation(chosen || null);
        setSelectedPickupCity((chosen && chosen.address && chosen.address.city) ? chosen.address.city : 'All');
        try { localStorage.setItem('selectedPickupIndex', String(idx)); } catch {}
      }}
      onChangeOrderType={() => setFulfillmentOpen(true)}
      onPickupDateChange={(val) => setPickupDate(val)}
      onPickupTimeChange={(val) => setPickupTime(val)}
    />
  );

  return (
    <div className="shop-app">
      <div className={`cart-backdrop ${mobileCartOpen ? 'active' : ''}`} data-show={mobileCartOpen ? 'true' : 'false'} onClick={() => setMobileCartOpen(false)} />

      <CartSidebar
        open={mobileCartOpen}
        onClose={() => setMobileCartOpen(false)}
        onCheckout={() => {
          const hasToken = !!getAuthToken();
          if (!hasToken) {
            setMobileCartOpen(false);
            setLoginOpen(true);
            return;
          }
          // Close cart before showing next step so modal is visible on mobile
          setMobileCartOpen(false);
          if (!state.fulfillmentType) {
            setFulfillmentOpen(true);
            return;
          }
          if (state.fulfillmentType === 'delivery') {
            setDeliveryModalOpen(true);
            return;
          }
          // Default to pickup order details if pickup is selected
          setOrderDetailsOpen(true);
        }}
        readyAt={readyAt}
      />
      <TopNav siteSlug={siteSlug} isCartOpen={mobileCartOpen} onSignIn={() => setLoginOpen(true)} onOpenCart={() => setMobileCartOpen(true)} cartCount={state.items.length} />
      <main className="content">

        <div className="card order-type-card">
          <OrderTypeSelection />
        </div>

        {content}
      </main>

      <button className="cart-fab hide-desktop" aria-label="Open cart" onClick={() => setMobileCartOpen(true)}>
        <span className="cart-fab__icon">🛒</span>
        {state.items.length > 0 ? <span className="cart-fab__badge" aria-label={`Items in cart: ${state.items.length}`}>{state.items.length}</span> : null}
      </button>

      <PrivacyPolicyModal open={privacyOpen} onAccept={handleAcceptPrivacy} />
      <FulfillmentModal open={fulfillmentOpen} onChoose={handleChooseFulfillment} />
      {/* Order Details Modal: Takeout/Delivery UI like screenshots */}
      <Modal open={orderDetailsOpen} onClose={() => setOrderDetailsOpen(false)} title="ORDER DETAILS" footer={(
        state.fulfillmentType === 'pickup' ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
            {/* Removed OK button; Confirm remains */}
            <button className="primary-btn" disabled={!selectedLocation || manifest.length === 0} onClick={async () => {
              try {
                setOrderError('');
                const token = getAuthToken();
                if (!token) { setOrderDetailsOpen(false); setLoginOpen(true); return; }
                const chosenLocation = selectedLocation || filteredLocations[0] || locations[0] || null;
                if (!chosenLocation) { setOrderError('Please choose a pickup location'); return; }
                if (!manifest.length) { setOrderError('Please add items to your cart before confirming'); return; }
                if (!selectedLocation) setSelectedLocation(chosenLocation);
                const payload = {
                  items: manifest.map((m) => ({ name: m.name, quantity: m.quantity, priceCents: m.priceCents || 0, size: m.size, spiceLevel: m.spiceLevel })),
                  tipCents: 0,
                  pickup: {
                    location: chosenLocation,
                    scheduledFor: readyAt,
                  },
                  notes: state.notes || undefined,
                  coupon: state.coupon || undefined,
                };
                if (pickupPaymentMethod === 'online') {
                  await postJson(`/api/payments/stripe/${siteSlug}/checkout/pickup`, payload)
                    .then((data) => {
                      const url = data?.url;
                      if (!url) throw new Error('Failed to start payment');
                      setOrderDetailsOpen(false);
                      window.location.href = url;
                    });
                } else {
                  await postJson(`/api/shop/${siteSlug}/orders/pickup`, payload)
                    .then(() => {
                      setOrderDetailsOpen(false);
                      try { window.location.href = `/s/${siteSlug}/orders?status=placed`; } catch {}
                    });
                }
              } catch (e) {
                let msg = e?.message || 'Failed to place pickup order';
                try {
                  const parsed = JSON.parse(msg);
                  if (parsed && parsed.error) msg = parsed.error;
                } catch {}
                setOrderError(msg);
              }
            }}>Confirm</button>
          </div>
        ) : null
      )}>
        {state.fulfillmentType === 'delivery' ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="primary-btn" disabled>Delivery</button>
              <button onClick={() => setFulfillmentOpen(true)}>Pickup</button>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              Enter your address to see delivery ETA and fee.
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {cities.length ? `Serving: ${cities.join(', ')}` : 'Delivery cities will be shown during checkout'}
            </div>
            <button className="primary-btn" onClick={() => setDeliveryModalOpen(true)}>Add delivery details</button>
          </div>
        ) : (
          <div>
            {orderError ? <div style={{ color: 'var(--danger)', marginBottom: 10 }}>{orderError}</div> : null}
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Pickup selected</div>
            {/* Tab header like screenshot */}
            <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
              <button onClick={() => setPickupTab('location')} style={{ border: 'none', background: 'transparent', padding: '8px 2px', fontWeight: pickupTab==='location'?800:600, color: pickupTab==='location'? 'var(--text)' : 'var(--muted)', borderBottom: pickupTab==='location'? '2px solid var(--primary-600)' : '2px solid transparent' }}>By location</button>
              <button onClick={() => setPickupTab('city')} style={{ border: 'none', background: 'transparent', padding: '8px 2px', fontWeight: pickupTab==='city'?800:600, color: pickupTab==='city'? 'var(--text)' : 'var(--muted)', borderBottom: pickupTab==='city'? '2px solid var(--primary-600)' : '2px solid transparent' }}>By city</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              {pickupTab === 'city' ? (
                <>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>City</span>
                    <select value={selectedPickupCity} onChange={(e) => {
                      const val = e.target.value;
                      setSelectedPickupCity(val);
                      const nextList = (val && val !== 'All') ? locations.filter((l) => (l?.address?.city || '').toLowerCase() === val.toLowerCase()) : locations;
                      setSelectedLocation(nextList[0] || null);
                    }}>
                      <option value="All">All</option>
                      {Array.from(new Set(cities)).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>


                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>Restaurant location</span>
                    <select value={(idx => (idx >= 0 ? String(idx) : ''))(filteredLocations.findIndex((l) => l === selectedLocation))} onChange={(e) => {
                      const idx = Number(e.target.value);
                      const chosen = filteredLocations[idx];
                      setSelectedLocation(chosen || null);
                      try { localStorage.setItem('selectedPickupIndex', String(locations.findIndex((l) => l === chosen))); } catch {}
                    }}>
                      {filteredLocations.findIndex((l) => l === selectedLocation) < 0 ? <option value="" disabled>Select a location</option> : null}
                      {filteredLocations.map((loc, idx) => (
                        <option key={`${loc.name}-${idx}`} value={String(idx)}>{`${loc.name || 'Restaurant'} — ${(loc.address?.streetAddress || []).join(' ')}, ${loc.address?.city || ''}`}</option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                  <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>Restaurant location</span>
                  <select value={(idx => (idx >= 0 ? String(idx) : ''))(locations.findIndex((l) => l === selectedLocation))} onChange={(e) => {
                    const idx = Number(e.target.value);
                    const chosen = locations[idx];
                    setSelectedLocation(chosen || null);
                    setSelectedPickupCity(chosen?.address?.city || 'All');
                    try { localStorage.setItem('selectedPickupIndex', String(idx)); } catch {}
                  }}>
                    {locations.findIndex((l) => l === selectedLocation) < 0 ? <option value="" disabled>Select a location</option> : null}
                    {locations.map((loc, idx) => (
                      <option key={`${loc.name}-${idx}`} value={String(idx)}>{`${loc.name || 'Restaurant'} — ${(loc.address?.streetAddress || []).join(' ')}, ${loc.address?.city || ''}`}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {filteredLocations.length === 0 ? <div className="muted" style={{ marginBottom: 12 }}>No pickup locations available.</div> : null}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>Day</span>
                <select value={pickupDate} onChange={(e) => setPickupDate(e.target.value)}>
                  {dateOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ color: 'var(--primary-600)' }}>Pickup Time</span>
                {(() => {
                  const times = (timeOptions && timeOptions.length) ? timeOptions : (() => {
                    const out = [];
                    let h = 10, m = 0; // 10:00 AM to 10:00 PM fallback
                    while (h < 22 || (h === 22 && m === 0)) {
                      const mod = h >= 12 ? 'PM' : 'AM';
                      const h12 = h % 12 === 0 ? 12 : h % 12;
                      const label = `${h12}:${String(m).padStart(2,'0')} ${mod}`;
                      out.push({ value: label, label });
                      m += 45; if (m >= 60) { m -= 60; h += 1; }
                    }
                    return out;
                  })();
                  const firstEnabled = times.find((t) => !t.disabled);
                  const value = pickupTime || (firstEnabled?.value || '');
                  return (
                    <select value={value} onChange={(e) => setPickupTime(e.target.value)}>
                      {times.map((t) => (
                        <option key={t.value} value={t.value} disabled={!!t.disabled}>{t.label}</option>
                      ))}
                    </select>
                  );
                })()}
              </label>
            </div>
            {/* Payment method for pickup */}
            {/* Payment method simplified: remove Cash on pickup option */}
            <div className="card" style={{ display: 'grid', gap: 8, padding: 10, borderRadius: 12, marginTop: 10 }}>
              <div style={{ fontWeight: 700 }}>Payment method</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="radio"
                  name="pickupPay"
                  value="online"
                  checked={pickupPaymentMethod === 'online'}
                  onChange={() => setPickupPaymentMethod('online')}
                />
                <span>Pay online</span>
              </label>
            </div>
          </div>
        )}
      </Modal>
      <DeliveryAddressModal
        open={deliveryModalOpen}
        siteSlug={siteSlug}
        initialPickupIndex={(idx => (idx >= 0 ? idx : (() => { const s = Number(localStorage.getItem('selectedPickupIndex')); return Number.isFinite(s) ? s : -1; })()))(locations.findIndex((l) => l === selectedLocation))}
        onClose={() => setDeliveryModalOpen(false)}
        onConfirmed={(id, summary) => {
          setLastDeliveryId(id);
          if (summary) setDeliveryAddressSummary(summary);
          // Do not navigate away; user continues payment in Stripe
        }}
        manifest={manifest}
      />
      {lastDeliveryId ? (
        <div className="muted" style={{ textAlign: 'center', marginTop: 10, fontSize: 12 }}>Last delivery ID: {lastDeliveryId}</div>
      ) : null}
      <SpiceModal
        open={spiceOpen}
        spiceLevels={pendingProduct?.spiceLevels}
        product={pendingProduct}
        category={(pendingProduct && allCategories.find(c => String(c._id) === String(pendingProduct.categoryId))) || selectedCategory || null}
        siteLogoSrc={(function(){
          try {
            const el = document.querySelector('.brand__logo img');
            return el ? el.getAttribute('src') : '';
          } catch { return ''; }
        })()}
        initialQuantity={pendingQuantity}
        onCancel={() => setSpiceOpen(false)}
        onConfirm={confirmSpice}
      />
      <ExtrasModal open={extrasOpen} groups={pendingProduct?.extraOptionGroups} product={pendingProduct} onCancel={() => setExtrasOpen(false)} onConfirm={confirmExtras} />
      <VariantModal open={variantOpen} variants={pendingProduct?.variants || []} product={pendingProduct} onCancel={() => setVariantOpen(false)} onConfirm={confirmVariant} />
      <AddToCartToast />
      <UserAuthModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => {
        setLoginOpen(false);
        // Stay on the same page. If no order type yet, prompt selection.
        if (!state.fulfillmentType) {
          setFulfillmentOpen(true);
          return;
        }
        // If delivery was selected before login, continue to delivery details.
        if (state.fulfillmentType === 'delivery') {
          setDeliveryModalOpen(true);
        }
        // If pickup, keep user here; they can open order details from cart.
      }} />
      <footer className="site-footer">© All Rights Reserved By Blue Boxx</footer>
    </div>
  );
};

export const ShopApp = ({ siteSlug = 'default', initialCategoryId }) => {
  return <Main siteSlug={siteSlug} initialCategoryId={initialCategoryId} />;
};