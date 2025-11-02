import React, { useEffect, useMemo, useState } from 'react';
import { useCart } from './store/CartContext';
import { CartSidebar } from './components/CartSidebar';
import { CategoryGrid } from './components/CategoryGrid';
// import { StoreHeader } from './components/StoreHeader';
import { TopNav } from './components/TopNav';
import { OrderDetailsBar } from './components/OrderDetailsBar';
// Banner removed per latest design
import { AddressAutocomplete } from './components/AddressAutocomplete';
import { ProductList } from './components/ProductList';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
import { Modal } from './components/Modal';
import { AlertModal } from './components/AlertModal';
import { getAuthToken, postJson } from './lib/api';
import { useCategoriesQuery, useSiteQuery, useLocationsQuery, useCitiesQuery, useHoursQuery } from './lib/queries';
// Lazy-loaded modals and UI pieces for faster initial paint
const FulfillmentModal = React.lazy(() => import('./components/FulfillmentModal').then(m => ({ default: m.FulfillmentModal })));
const DeliveryAddressModal = React.lazy(() => import('./components/DeliveryAddressModal').then(m => ({ default: m.DeliveryAddressModal })));
const UserAuthModal = React.lazy(() => import('./components/UserAuthModal').then(m => ({ default: m.UserAuthModal })));
const SpiceModal = React.lazy(() => import('./components/SpiceModal').then(m => ({ default: m.SpiceModal })));
const ExtrasModal = React.lazy(() => import('./components/ExtrasModal').then(m => ({ default: m.ExtrasModal })));
const AddToCartToast = React.lazy(() => import('./components/AddToCartToast').then(m => ({ default: m.AddToCartToast })));

const hasAny = (value, predicate) => Array.isArray(value) && value.some(predicate);
const hasNonEmptyText = (val) => typeof val === 'string' && val.trim().length > 0;
const hasLabeledOption = (opt) => !!opt && (hasNonEmptyText(opt?.label) || hasNonEmptyText(opt?.key));
const groupHasSelectableOptions = (group) => Array.isArray(group?.options) && group.options.some(hasLabeledOption);

const doesProductHaveExtras = (product) => hasAny(product?.extraOptionGroups, groupHasSelectableOptions);

const doesProductNeedSpiceModal = (product) => (
  hasAny(product?.variants, hasLabeledOption)
  || hasAny(product?.spiceLevels, hasNonEmptyText)
  || hasAny(product?.flavors, hasLabeledOption)
  || hasAny(product?.portions, hasLabeledOption)
  || hasAny(product?.quantities, hasLabeledOption)
);

const doesProductNeedGuidedFlow = (product) => doesProductNeedSpiceModal(product) || doesProductHaveExtras(product);

const Main = ({ siteSlug = 'default', initialCategoryId }) => {
  const { state, setFulfillmentType, addItem, getCartTotal } = useCart();
  const [privacyOpen, setPrivacyOpen] = useState(true);
  const [fulfillmentOpen, setFulfillmentOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  // Categories come from query; avoid duplicating into state
  const [pendingProduct, setPendingProduct] = useState(null);
  const [pendingQuantity, setPendingQuantity] = useState(1);
  const [spiceOpen, setSpiceOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [pendingSpice, setPendingSpice] = useState(undefined);
  const [pendingVariant, setPendingVariant] = useState(null);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [deliveryModalMode, setDeliveryModalMode] = useState('checkout'); // 'prefill' | 'checkout'
  const [loginOpen, setLoginOpen] = useState(false);
  const [vegFilter, setVegFilter] = useState('all');
  const [lastDeliveryId, setLastDeliveryId] = useState(null);
  const [deliveryAddressSummary, setDeliveryAddressSummary] = useState('');
  const [orderError, setOrderError] = useState('');
  const [pickupPaymentMethod, setPickupPaymentMethod] = useState('online'); // 'online' | 'cod'
  const [site, setSite] = useState(null);
  // Track 'Order Now' vs 'Order For Later' selection to allow checkout when closed
  const [orderWhen, setOrderWhen] = useState(null); // 'now' | 'later' | null
  const [pickupSubmitting, setPickupSubmitting] = useState(false);
  const [pendingQuantityOption, setPendingQuantityOption] = useState(null);

  // Additional UI state brought from the alternate implementation
  // Order details state
  const [pickupDate, setPickupDate] = useState(''); // YYYY-MM-DD
  const [pickupTime, setPickupTime] = useState(''); // e.g., 10:00 AM
  const [hours, setHours] = useState(null);
  const [timeZone, setTimeZone] = useState('');
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
  
  const minutesUntilReady = React.useMemo(() => {
    try {
      if (!readyAt) return null;
      const now = Date.now();
      const ms = new Date(readyAt).getTime() - now;
      return Math.max(0, Math.round(ms / 60000));
    } catch { return null; }
  }, [readyAt]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locations, setLocations] = useState([]);
  const [cities, setCities] = useState([]);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [selectedPickupCity, setSelectedPickupCity] = useState('All');
  const [pickupTab, setPickupTab] = useState('location'); // address | location | city
  // Inline delivery address input state
  const [deliveryInlineAddrText, setDeliveryInlineAddrText] = useState('');
  const [deliveryInlineAddr, setDeliveryInlineAddr] = useState(null);

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

  function isOpenNowLocal() {
    try {
      if (!hours) return true; // default open if unknown
      const now = new Date();
      const dayKey = ['sun','mon','tue','wed','thu','fri','sat'][now.getDay()];
      const config = hours?.[dayKey] || { open: '10:00', close: '22:00', closed: false };
      if (config.closed) return false;
      const [openH, openM] = String(config.open || '10:00').split(':').map(Number);
      const [closeH, closeM] = String(config.close || '22:00').split(':').map(Number);
      const openMinutes = (openH || 0) * 60 + (openM || 0);
      // last order 15 minutes before close
      const lastOrderMinutes = (closeH || 0) * 60 + Math.max(0, (closeM || 0) - 15);
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      return nowMinutes >= openMinutes && nowMinutes <= lastOrderMinutes;
    } catch { return true; }
  }

  const [closedAlertOpen, setClosedAlertOpen] = useState(false);

  function handleChooseFulfillment(type) {
    // Legacy handler retained for safety; not used by new modal.
    setFulfillmentType(type);
    setFulfillmentOpen(false);
  }

  function startAddToCart(argProduct, quantity = 1) {
    // Support both legacy signature (product, quantity) and new object with pickupOnlyCategory flag
    const product = (argProduct && argProduct.product) ? argProduct.product : argProduct;
    const pickupOnlyCategory = !!(argProduct && argProduct.pickupOnlyCategory);
    const normalizedQty = Math.max(1, Math.min(99, Number(quantity) || 1));

    const needsSpiceModal = doesProductNeedSpiceModal(product);
    const hasExtras = doesProductHaveExtras(product);

    if (needsSpiceModal || hasExtras) {
      setPendingProduct(product);
      setPendingQuantity(normalizedQty);
      setPendingQuantityOption(null);
    }

    if (needsSpiceModal) {
      setSpiceOpen(true);
      return;
    }

    if (hasExtras) {
      setExtrasOpen(true);
      return;
    }

    addItem({ product, quantity: normalizedQty, pickupOnlyCategory });
    setPendingProduct(null);
    setPendingSpice(undefined);
    setPendingVariant(null);
    setPendingQuantity(1);
    setPendingQuantityOption(null);
    // Do not open payment/details modals on add-to-cart; user will open from cart
  }

  function confirmSpice(result) {
    const { spice, variant, flavor, portion, quantity, quantityOption } = result || {};
    const confirmedQty = Math.max(1, Math.min(99, Number(quantity || pendingQuantity) || 1));
    setPendingSpice(spice);
    setPendingVariant(variant || null);
    setPendingQuantity(confirmedQty);
    setPendingQuantityOption(quantityOption || null);
    setSpiceOpen(false);
    if (pendingProduct && doesProductHaveExtras(pendingProduct)) {
      setExtrasOpen(true);
    } else if (pendingProduct) {
      // Derive pickupOnly flag by checking the selectedCategory if available
      const isPickupOnly = !!(selectedCategory && selectedCategory.pickupOnly);
      addItem({ product: pendingProduct, variant: variant || undefined, spiceLevel: spice, flavor: flavor || undefined, portion: portion || undefined, quantityOption: quantityOption || undefined, quantity: confirmedQty, pickupOnlyCategory: isPickupOnly });
      setPendingProduct(null);
      setPendingSpice(undefined);
      setPendingVariant(null);
      setPendingQuantity(1);
      setPendingQuantityOption(null);
    }
  }

  function confirmExtras(selected) {
    setExtrasOpen(false);
    if (pendingProduct) {
      const isPickupOnly = !!(selectedCategory && selectedCategory.pickupOnly);
      addItem({ product: pendingProduct, variant: pendingVariant || undefined, spiceLevel: pendingSpice, selectedOptions: selected, quantityOption: pendingQuantityOption || undefined, quantity: pendingQuantity, pickupOnlyCategory: isPickupOnly });
    }
    setPendingProduct(null);
    setPendingSpice(undefined);
    setPendingVariant(null);
    setPendingQuantity(1);
    setPendingQuantityOption(null);
  }

  const { data: categoriesData } = useCategoriesQuery(siteSlug);
  const categories = React.useMemo(
    () => (Array.isArray(categoriesData) ? categoriesData : []),
    [categoriesData]
  );
  useEffect(() => {
    if (!initialCategoryId || !Array.isArray(categories) || categories.length === 0) return;
    const found = categories.find((c) => String(c._id) === String(initialCategoryId));
    if (found) setSelectedCategory(found);
  }, [categories, initialCategoryId]);

  // Load site basics for support info (WhatsApp, etc.)
  const { data: siteData } = useSiteQuery(siteSlug);
  useEffect(() => { setSite(siteData || null); }, [siteData]);

  // Load pickup locations for popup
  const { data: locationsData, isLoading: loadingLocations } = useLocationsQuery(siteSlug);
  const { data: citiesData, isLoading: loadingCities } = useCitiesQuery(siteSlug);
  useEffect(() => {
    const arr = Array.isArray(locationsData) ? locationsData : [];
    setLocations(arr);
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
  }, [locationsData]);
  useEffect(() => {
    setCities(Array.isArray(citiesData) ? citiesData : []);
    setSelectedPickupCity('All');
  }, [citiesData]);

  // Load site opening hours
  const { data: hoursResp, isLoading: loadingHours } = useHoursQuery(siteSlug);
  useEffect(() => {
    if (!hoursResp) return;
    if (hoursResp && hoursResp.hours) {
      setHours(hoursResp.hours);
      setTimeZone(hoursResp.timeZone || '');
    } else {
      setHours(hoursResp);
      setTimeZone('');
    }
  }, [hoursResp]);

  // Closed-state logic removed to keep UI always open

  // Compute date options (today + next 6 days)
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
      // Always include all days regardless of closed flag
      opts.push({ value, label: formatDateLabel(d, i === 0) });
    }
    setDateOptions(opts);
    if (!pickupDate && opts.length) setPickupDate(opts[0].value);
  }, [hours]);

  // Compute time options for selected date from hours (default 10:00-22:00)
  // - Slots every 15 minutes
  // - Earliest selectable time is now + 30 minutes (prep buffer)
  // - Last order 15 minutes before close (e.g., 9:45 PM when closing at 10:00 PM)
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
    // Prep buffer of 30 minutes
    const earliest = new Date(now.getTime() + 30 * 60000);
    const [selYr, selMo, selDy] = pickupDate.split('-').map(Number);
    const key = dayKeyFromDateString(pickupDate);
    const cfg = hours?.[key] || { open: '10:00', close: '22:00', closed: false };
    const { hh: openH = 10, mm: openM = 0 } = parse24h(cfg.open, { hh: 10, mm: 0 });
    const { hh: closeH = 22, mm: closeM = 0 } = parse24h(cfg.close, { hh: 22, mm: 0 });
    // Last selectable slot should be 15 minutes before close
    let endH = closeH;
    let endM = closeM - 15;
    if (endM < 0) { endH -= 1; endM += 60; }
    const options = [];
    let curH = openH, curM = openM;
    while (curH < endH || (curH === endH && curM <= endM)) {
      const value = format12h(curH, curM);
      let disabled = false;
      if (isTodaySelected) {
        const candidate = new Date(selYr, (selMo || 1) - 1, selDy || 1);
        candidate.setHours(curH, curM, 0, 0);
        disabled = candidate < earliest;
      }
      options.push({ value, label: value, disabled });
      curM += 15;
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
          shouldUseGuidedFlow={doesProductNeedGuidedFlow}
        />
      );
    }
    return <CategoryGrid onSelect={setSelectedCategory} siteSlug={siteSlug} />;
  }, [selectedCategory, siteSlug, vegFilter]);

  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const manifest = useMemo(() => {
    return state.items.map((it) => {
      const unitCents = Number.isFinite(it.unitCents)
        ? Math.max(0, Math.round(Number(it.unitCents)))
        : Math.round(((Number(it.basePrice) || 0) + (Number(it?.variant?.price) || 0) + (Number(it?.extraCost) || 0)) * 100);
      return {
        name: it.name,
        quantity: it.quantity,
        priceCents: unitCents,
        productId: it.productId,
        categoryId: it.categoryId,
        size: (it?.variant?.label || it?.variant?.key || undefined),
        spiceLevel: it.spiceLevel,
        flavor: it?.flavor?.label || it?.flavor?.key || undefined,
        portion: it?.portion?.label || it?.portion?.key || undefined,
        quantityOption: it?.quantityOption?.label || it?.quantityOption?.key || undefined,
      };
    });
  }, [state.items]);

  const cartTotal = getCartTotal();

  const pickupAddressSummary = selectedLocation ? `${selectedLocation?.name || 'Restaurant'} ? ${(selectedLocation?.address?.streetAddress || []).join(' ')}, ${selectedLocation?.address?.city || ''}` : undefined;
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
      orderType={state.fulfillmentType === 'delivery' ? 'Delivery' : (state.fulfillmentType === 'pickup' ? 'Takeout' : 'Select order type')}
      pickupDate={pickupDate}
      pickupTime={pickupTime}
      dateOptions={dateOptions}
      timeOptions={timeOptions}
      // Hide restaurant location inside order details per new design
      addressSummary={undefined}
      minutesUntilReady={typeof minutesUntilReady === 'number' ? minutesUntilReady : undefined}
      locations={[]}
      selectedLocationIndex={undefined}
      onChangeLocation={undefined}
      onChangeOrderType={() => setFulfillmentOpen(true)}
      onPickupDateChange={(val) => setPickupDate(val)}
      onPickupTimeChange={(val) => setPickupTime(val)}
      showAddressInput={state.fulfillmentType === 'delivery'}
      addressInput={deliveryInlineAddrText}
      onAddressInputChange={(t) => setDeliveryInlineAddrText(t)}
      AddressAutocomplete={AddressAutocomplete}
      siteSlug={siteSlug}
      onAddressSelected={(addr, summary) => {
        setDeliveryInlineAddr(addr);
        setDeliveryAddressSummary(summary || '');
      }}
      loading={loadingHours || loadingLocations || (!hours) || (state.fulfillmentType === 'pickup' && locations.length === 0 && (loadingCities || loadingLocations))}
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
          // Block checkout when restaurant is closed ONLY if 'Order Now' was chosen.
          if (!isOpenNowLocal() && orderWhen === 'now') {
            setMobileCartOpen(false);
            setClosedAlertOpen(true);
            return;
          }
          // Close cart before showing next step so modal is visible on mobile
          setMobileCartOpen(false);
          if (!state.fulfillmentType) {
            setFulfillmentOpen(true);
            return;
          }
          if (state.fulfillmentType === 'delivery') {
            setDeliveryModalMode('checkout');
            setDeliveryModalOpen(true);
            return;
          }
          // Default to pickup order details if pickup is selected
          setOrderDetailsOpen(true);
        }}
        readyAt={readyAt}
      />
      <TopNav siteSlug={siteSlug} isCartOpen={mobileCartOpen} onSignIn={() => setLoginOpen(true)} onOpenCart={() => setMobileCartOpen(true)} cartCount={state.items.length} />
      {(() => {
        // Remove banner and reserve no extra height
        try { document.documentElement.style.setProperty('--banner-height', '0px'); } catch {}
        return null;
      })()}
      <main className="content">

        {/* Top restaurant location bar (grey) */}
        <div className="animate-popIn" style={{
          maxWidth: 1280,
          margin: '0 auto 12px',
          background: '#6b7280',
          color: '#fff',
          borderRadius: 12,
          padding: 16,
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 16,
          alignItems: 'center'
        }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>{site?.name || 'Restaurant'}</div>
            {site?.tagline ? (<div style={{ fontSize: 13, opacity: 0.95 }}>{site.tagline}</div>) : null}
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.95 }}>Restaurant Location</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'center' }}>
                <select
                  value={(idx => (idx >= 0 ? String(idx) : ''))(locations.findIndex((l) => l === selectedLocation))}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    const chosen = locations[idx];
                    setSelectedLocation(chosen || null);
                    setSelectedPickupCity((chosen && chosen.address && chosen.address.city) ? chosen.address.city : 'All');
                    try { localStorage.setItem('selectedPickupIndex', String(idx)); } catch {}
                  }}
                  style={{
                    background: '#fff',
                    color: '#111827',
                    borderRadius: 9999,
                    padding: '10px 14px',
                    border: 'none',
                    minWidth: 220,
                  }}
                >
                  {(locations.findIndex((l) => l === selectedLocation) < 0) ? <option value="" disabled>Select a location</option> : null}
                  {locations.map((loc, idx) => (
                    <option key={`${loc?.name || 'loc'}-${idx}`} value={String(idx)}>
                      {(loc?.name || 'Restaurant')} ? {(Array.isArray(loc?.address?.streetAddress) ? loc.address.streetAddress.join(' ') : '')}{loc?.address?.city ? `, ${loc.address.city}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setMobileCartOpen(true)}
                  role="button"
                  aria-label="Order online"
                  className="elevated"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '12px 18px',
                    borderRadius: 8,
                    border: '1px solid var(--primary-600)',
                    background: 'var(--primary-600)',
                    color: '#fff',
                    fontWeight: 900,
                    letterSpacing: '.03em',
                    textTransform: 'uppercase',
                    cursor: 'pointer'
                  }}
                >
                  ORDER ONLINE
                </button>
              </div>
            </div>
          </div>
        </div>

        <OrderTypeSelection />

        {content}
      </main>

      <button className="cart-fab hide-desktop" aria-label="Open cart" onClick={() => setMobileCartOpen(true)} style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <span className="cart-fab__icon">??</span>
        {state.items.length > 0 ? <span className="cart-fab__badge" aria-label={`Items in cart: ${state.items.length}`}>{state.items.length}</span> : null}
      </button>

      <PrivacyPolicyModal open={privacyOpen} onAccept={handleAcceptPrivacy} />
      <React.Suspense fallback={<div className="loading-center"><div className="spinner" aria-label="Loading dialog" /></div>}>
      <FulfillmentModal
        open={fulfillmentOpen}
        onClose={() => setFulfillmentOpen(false)}
        siteSlug={siteSlug}
        AddressAutocomplete={AddressAutocomplete}
        pickupDate={pickupDate}
        pickupTime={pickupTime}
        dateOptions={dateOptions}
        timeOptions={timeOptions}
        onPickupDateChange={setPickupDate}
        onPickupTimeChange={setPickupTime}
        selectedType={state.fulfillmentType}
        onConfirmPickup={({ when }) => {
          setFulfillmentType('pickup');
          setOrderWhen(when || null);
          setFulfillmentOpen(false);
          // If closed and 'Order Now' selected, show closed alert
          if (!isOpenNowLocal() && when === 'now') { setClosedAlertOpen(true); }
        }}
        onConfirmDelivery={({ when, address, summary }) => {
          setFulfillmentType('delivery');
          setOrderWhen(when || null);
          setFulfillmentOpen(false);
          if (summary) setDeliveryAddressSummary(summary);
          if (address) setDeliveryInlineAddr(address);
          if (summary) setDeliveryInlineAddrText(summary);
        }}
      />
      </React.Suspense>
      <AlertModal
        open={closedAlertOpen}
        onClose={() => setClosedAlertOpen(false)}
        title="Restaurant is currently closed"
        message="Online ordering is unavailable right now. Please check our hours and try again."
        confirmLabel="OK"
      />
      {/* Order Details Modal: Takeout/Delivery UI like screenshots */}
      <Modal open={orderDetailsOpen} onClose={() => setOrderDetailsOpen(false)} title="ORDER DETAILS" footer={(
        state.fulfillmentType === 'pickup' ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
            {/* Removed OK button; Confirm remains */}
            <button className="primary-btn" disabled={pickupSubmitting || !selectedLocation || manifest.length === 0} aria-busy={pickupSubmitting} onClick={async () => {
              setPickupSubmitting(true);
              try {
                setOrderError('');
                const token = getAuthToken();
                if (!token) { setOrderDetailsOpen(false); setLoginOpen(true); return; }
                const chosenLocation = selectedLocation || filteredLocations[0] || locations[0] || null;
                if (!chosenLocation) { setOrderError('Please choose a pickup location'); return; }
                if (!manifest.length) { setOrderError('Please add items to your cart before confirming'); return; }
                if (!selectedLocation) setSelectedLocation(chosenLocation);
                const payload = {
                  items: manifest.map((m) => ({ name: m.name, quantity: m.quantity, priceCents: m.priceCents || 0, size: m.size, spiceLevel: m.spiceLevel, flavor: m.flavor, portion: m.portion })),
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
                let msg = e?.message || 'Failed to place takeout order';
                try {
                  const parsed = JSON.parse(msg);
                  if (parsed && parsed.error) msg = parsed.error;
                } catch {}
                setOrderError(msg);
              } finally {
                setPickupSubmitting(false);
              }
            }}>
              {pickupSubmitting ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 50 50" aria-hidden="true" focusable="false">
                    <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeDasharray="31.415 31.415">
                      <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.8s" repeatCount="indefinite" />
                    </circle>
                  </svg>
                  Processing?
                </span>
              ) : (
                'Confirm'
              )}
            </button>
          </div>
        ) : null
      )}>
        {state.fulfillmentType === 'delivery' ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="primary-btn" disabled>Delivery</button>
              <button onClick={() => setFulfillmentOpen(true)}>Takeout</button>
            </div>
            {/* Support block removed per requirement */}
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
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Takeout selected</div>
            {/* Support block removed per requirement */}
            {/* Tab header like screenshot */}
            <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
              <button onClick={() => setPickupTab('location')} style={{ border: 'none', background: 'transparent', padding: '8px 2px', fontWeight: pickupTab==='location'?800:600, color: pickupTab==='location'? 'var(--text)' : 'var(--muted)', borderBottom: pickupTab==='location'? '2px solid var(--primary-600)' : '2px solid transparent' }}>By location</button>
              <button onClick={() => setPickupTab('city')} style={{ border: 'none', background: 'transparent', padding: '8px 2px', fontWeight: pickupTab==='city'?800:600, color: pickupTab==='city'? 'var(--text)' : 'var(--muted)', borderBottom: pickupTab==='city'? '2px solid var(--primary-600)' : '2px solid transparent' }}>By city</button>
            </div>
            <div className="form-grid" style={{ gap: 12, marginBottom: 12 }}>
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
                    <span>Restaurant Location</span>
                    <select value={(idx => (idx >= 0 ? String(idx) : ''))(filteredLocations.findIndex((l) => l === selectedLocation))} onChange={(e) => {
                      const idx = Number(e.target.value);
                      const chosen = filteredLocations[idx];
                      setSelectedLocation(chosen || null);
                      try { localStorage.setItem('selectedPickupIndex', String(locations.findIndex((l) => l === chosen))); } catch {}
                    }}>
                      {filteredLocations.findIndex((l) => l === selectedLocation) < 0 ? <option value="" disabled>Select a location</option> : null}
                      {filteredLocations.map((loc, idx) => (
                        <option key={`${loc.name}-${idx}`} value={String(idx)}>{`${loc.name || 'Restaurant'} ? ${(loc.address?.streetAddress || []).join(' ')}, ${loc.address?.city || ''}`}</option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                  <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>Restaurant Location</span>
                  <select value={(idx => (idx >= 0 ? String(idx) : ''))(locations.findIndex((l) => l === selectedLocation))} onChange={(e) => {
                    const idx = Number(e.target.value);
                    const chosen = locations[idx];
                    setSelectedLocation(chosen || null);
                    setSelectedPickupCity(chosen?.address?.city || 'All');
                    try { localStorage.setItem('selectedPickupIndex', String(idx)); } catch {}
                  }}>
                    {locations.findIndex((l) => l === selectedLocation) < 0 ? <option value="" disabled>Select a location</option> : null}
                    {locations.map((loc, idx) => (
                      <option key={`${loc.name}-${idx}`} value={String(idx)}>{`${loc.name || 'Restaurant'} ? ${(loc.address?.streetAddress || []).join(' ')}, ${loc.address?.city || ''}`}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {filteredLocations.length === 0 ? <div className="muted" style={{ marginBottom: 12 }}>No pickup locations available.</div> : null}
            <div className="form-grid" style={{ gap: 12, marginTop: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>Day</span>
                <select value={pickupDate} onChange={(e) => setPickupDate(e.target.value)}>
                  {dateOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ color: 'var(--primary-600)' }}>Pick Up/Delivery Date and Time</span>
                {(() => {
                  const times = (timeOptions && timeOptions.length) ? timeOptions : (() => {
                  const out = [];
                  let h = 10, m = 0; // 10:00 AM to 9:45 PM fallback
                    let endH = 22, endM = 0; // 22:00 close by default
                    // last slot 15 minutes before close
                    endM -= 15; if (endM < 0) { endH -= 1; endM += 60; }
                    while (h < endH || (h === endH && m <= endM)) {
                      const mod = h >= 12 ? 'PM' : 'AM';
                      const h12 = h % 12 === 0 ? 12 : h % 12;
                      const label = `${h12}:${String(m).padStart(2,'0')} ${mod}`;
                      out.push({ value: label, label });
                      m += 15; if (m >= 60) { m -= 60; h += 1; }
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
      <React.Suspense fallback={<div className="loading-center"><div className="spinner" aria-label="Loading dialog" /></div>}>
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
        mode={deliveryModalMode}
        initialAddress={deliveryInlineAddr}
        initialSummary={deliveryAddressSummary}
      />
      </React.Suspense>
      {/* Last delivery ID removed from UI as requested */}
      <React.Suspense fallback={<div className="loading-center"><div className="spinner" aria-label="Loading dialog" /></div>}>
      <SpiceModal
        open={spiceOpen}
        spiceLevels={pendingProduct?.spiceLevels}
        product={pendingProduct}
        category={(pendingProduct && categories.find(c => String(c._id) === String(pendingProduct.categoryId))) || selectedCategory || null}
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
      </React.Suspense>
      <React.Suspense fallback={<div className="loading-center"><div className="spinner" aria-label="Loading dialog" /></div>}>
      <ExtrasModal open={extrasOpen} groups={pendingProduct?.extraOptionGroups} product={pendingProduct} onCancel={() => setExtrasOpen(false)} onConfirm={confirmExtras} />
      </React.Suspense>
      <React.Suspense fallback={null}>
        <AddToCartToast />
      </React.Suspense>
      <React.Suspense fallback={<div className="loading-center"><div className="spinner" aria-label="Loading dialog" /></div>}>
      <UserAuthModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => {
        setLoginOpen(false);
        // Stay on the same page. If no order type yet, prompt selection.
        if (!state.fulfillmentType) {
          setFulfillmentOpen(true);
          return;
        }
        // If delivery was selected before login, continue to delivery details.
        if (state.fulfillmentType === 'delivery') {
          setDeliveryModalMode('checkout');
          setDeliveryModalOpen(true);
        }
        // If pickup, keep user here; they can open order details from cart.
      }} />
      </React.Suspense>
      <footer className="site-footer">? All Rights Reserved By <a href="https://www.blueboxx.ca/" target="_blank" rel="noopener noreferrer">Blue Boxx</a></footer>
    </div>
  );
};

export const ShopApp = ({ siteSlug = 'default', initialCategoryId }) => {
  return <Main siteSlug={siteSlug} initialCategoryId={initialCategoryId} />;
};