import React from 'react';
import { useCart } from '../store/CartContext';
import { formatCents } from '../lib/money';
import { fetchJson } from '../lib/api';

export const CartSidebar = ({ open, onClose, onCheckout, readyAt }) => {
  const { state, removeItem, updateQuantity, clearCart, getCartTotal, setNotes, applyCoupon, clearCoupon, setCouponMinSubtotalCents, setDeliveryFeeCents } = useCart();
  const [code, setCode] = React.useState('');
  const [couponError, setCouponError] = React.useState('');
  const [checking, setChecking] = React.useState(false);
  const [now, setNow] = React.useState(Date.now());
  const [autoTried, setAutoTried] = React.useState(false);
  const [isSplitDelivery, setIsSplitDelivery] = React.useState(false);
  const [freeDeliveryEnabled, setFreeDeliveryEnabled] = React.useState(false);
  const [freeDeliveryMinSubtotalCents, setFreeDeliveryMinSubtotalCents] = React.useState(null);
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  // Ensure a sensible default: now + 30 minutes if not provided
  const effectiveReadyAt = React.useMemo(() => {
    return readyAt || new Date(Date.now() + 30 * 60000).toISOString();
  }, [readyAt, now]);
  const timeString = React.useMemo(() => new Date(effectiveReadyAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), [effectiveReadyAt]);
  const eta = React.useMemo(() => {
    const diffMs = new Date(effectiveReadyAt).getTime() - now;
    const mins = Math.max(0, Math.round(diffMs / 60000));
    return `(in ${mins} min)`;
  }, [effectiveReadyAt, now]);

  const subtotal = React.useMemo(() => state.items.reduce((s, it) => s + it.totalPrice, 0), [state.items]);
  // Use cents-based eligibility to avoid float drift across locales
  const couponEligible = React.useMemo(() => {
    const cents = Math.round(subtotal * 100);
    const min = Number(state.couponMinSubtotalCents) || 5000;
    return !!state.coupon && cents >= min;
  }, [state.coupon, subtotal, state.couponMinSubtotalCents]);

  // Keep site coupon minimum in sync from backend settings and auto-apply latest coupon
  React.useEffect(() => {
    const subtotal = state.items.reduce((s, it) => s + it.totalPrice, 0);
    let cancelled = false;
    (async () => {
      try {
        const siteSlug = (window.location.pathname.match(/\/s\/([^/]+)/)?.[1]) || 'default';
        // Fetch site settings to get couponMinSubtotalCents
        try {
          const site = await fetchJson(`/api/shop/${siteSlug}/site`);
          if (!cancelled && site && typeof site.couponMinSubtotalCents === 'number') {
            setCouponMinSubtotalCents(site.couponMinSubtotalCents);
          }
          if (!cancelled && site) {
            setIsSplitDelivery(!!site.splitDeliveryFee);
            setFreeDeliveryEnabled(!!site.freeDeliveryEnabled);
            setFreeDeliveryMinSubtotalCents(
              typeof site.freeDeliveryMinSubtotalCents === 'number'
                ? Number(site.freeDeliveryMinSubtotalCents)
                : null
            );
          }
        } catch {}
        const min = Number(state.couponMinSubtotalCents) || 5000;
        if (!autoTried && !state.coupon && subtotal >= (min / 100)) {
          const res = await fetchJson(`/api/shop/${siteSlug}/default-coupon`);
          if (!cancelled && res && res.code && typeof res.percent === 'number' && res.percent > 0) {
            applyCoupon(res.code, res.percent);
            setCode(res.code);
          }
          if (!cancelled) setAutoTried(true);
        }
      } catch {}
      finally {
        // no-op: autoTried is set only when we attempted an auto-apply
      }
    })();
    return () => { cancelled = true; };
  }, [state.items, state.coupon, applyCoupon, autoTried, state.couponMinSubtotalCents]);

  // Derived pricing (compute in cents to match backend/Stripe)
  const itemsSubtotalCents = React.useMemo(() => {
    return state.items.reduce((sum, it) => {
      const unitCents = Number.isFinite(it.unitCents)
        ? Math.max(0, Math.round(Number(it.unitCents)))
        : Math.round(((Number(it.basePrice) || 0) + (Number(it?.variant?.price) || 0) + (Number(it.extraCost) || 0)) * 100);
      return sum + unitCents * (Number(it.quantity) || 1);
    }, 0);
  }, [state.items]);
  const itemsSubtotal = React.useMemo(() => itemsSubtotalCents / 100, [itemsSubtotalCents]);

  // Coupon + delivery context
  const deliveryFeeCents = state.fulfillmentType === 'delivery' ? (Number(state.deliveryFeeCents || 0)) : 0;
  const eligibleForFreeDelivery = React.useMemo(() => {
    const min = (typeof freeDeliveryMinSubtotalCents === 'number') ? freeDeliveryMinSubtotalCents : null;
    return !!freeDeliveryEnabled && min !== null && itemsSubtotalCents >= min;
  }, [freeDeliveryEnabled, freeDeliveryMinSubtotalCents, itemsSubtotalCents]);
  // Use the same cents-based eligibility as backend/site setting
  const hasEligibleCoupon = React.useMemo(() => {
    const minCents = Number(state.couponMinSubtotalCents) || 5000;
    return !!state.coupon && itemsSubtotalCents >= minCents;
  }, [state.coupon, itemsSubtotalCents, state.couponMinSubtotalCents]);
  const couponPct = hasEligibleCoupon ? Math.max(0, Math.min(100, Number(state.coupon.percent) || 0)) : 0;

  // Items subtotal AFTER discount (per-LINE rounding) — matches backend/Stripe
  const itemsAfterDiscountCents = React.useMemo(() => {
    if (!hasEligibleCoupon || couponPct <= 0) return itemsSubtotalCents;
    return state.items.reduce((sum, it) => {
      const unitCents = Number.isFinite(it.unitCents)
        ? Math.max(0, Math.round(Number(it.unitCents)))
        : Math.round(((Number(it.basePrice) || 0) + (Number(it?.variant?.price) || 0) + (Number(it.extraCost) || 0)) * 100);
      const qty = Number(it.quantity) || 1;
      const lineCents = unitCents * qty;
      const discountedLine = Math.round(lineCents * (100 - couponPct) / 100);
      return sum + discountedLine;
    }, 0);
  }, [state.items, itemsSubtotalCents, hasEligibleCoupon, couponPct]);

  // Actual tax to be charged is on discounted items
  const taxAfterDiscountCents = React.useMemo(() => Math.round(itemsAfterDiscountCents * 0.05), [itemsAfterDiscountCents]);

  // Display tax and delivery exactly as charged (no gross-up)
  const taxDisplayCents = taxAfterDiscountCents;
  const deliveryDisplayCents = React.useMemo(() => {
    if (state.fulfillmentType === 'delivery' && eligibleForFreeDelivery) return 0;
    return deliveryFeeCents;
  }, [state.fulfillmentType, eligibleForFreeDelivery, deliveryFeeCents]);

  // Final payable total
  const grandTotalCents = React.useMemo(() => (
    Math.max(0, itemsAfterDiscountCents + taxAfterDiscountCents + deliveryDisplayCents)
  ), [itemsAfterDiscountCents, taxAfterDiscountCents, deliveryDisplayCents]);

  // Displayed subtotal before discount and discount amount
  const displayedSubtotalCents = React.useMemo(() => (
    itemsSubtotalCents + taxDisplayCents + deliveryDisplayCents
  ), [itemsSubtotalCents, taxDisplayCents, deliveryDisplayCents]);
  // Discount applies to items only
  const discountCents = React.useMemo(() => (
    hasEligibleCoupon ? Math.max(0, itemsSubtotalCents - itemsAfterDiscountCents) : 0
  ), [hasEligibleCoupon, itemsSubtotalCents, itemsAfterDiscountCents]);

  const discount = React.useMemo(() => discountCents / 100, [discountCents]);
  const tax = React.useMemo(() => taxDisplayCents / 100, [taxDisplayCents]);
  const deliveryFee = React.useMemo(() => deliveryDisplayCents / 100, [deliveryDisplayCents]);
  const grandTotal = React.useMemo(() => grandTotalCents / 100, [grandTotalCents]);

  return (
    <aside
      style={{
        position: 'fixed',
        // Anchor below header + dynamic banner height so height is always correct
        top: `calc(var(--header-height) + var(--banner-height) + 12px)`,
        right: 16,
        bottom: 16,
        width: 'var(--cart-width, 360px)',
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 16,
        overflowY: 'auto',
        // Ensure desktop cart sits above content and banner, below header dropdown
        zIndex: 700,
      }}
      className="cart-sidebar"
      data-open={open ? 'true' : 'false'}
    >
      <div className="card cart-header" style={{ padding: 14, borderRadius: 12, marginBottom: 12, borderTop: '3px solid var(--primary)', position: 'sticky', top: 0, background: '#fff', zIndex: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800 }}>Your order</div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12 }} className="muted">TOTAL</div>
            <div style={{ fontWeight: 800 }}>${formatCents(grandTotalCents)}</div>
          </div>
        </div>
      </div>
      {/* ORDER READY FOR section should scroll with content (no sticky) */}
      <div className="card" style={{ marginTop: 8, padding: 12, borderRadius: 10, background: 'var(--primary-alpha-04)', border: '1px dashed var(--primary-600)' }}>
        <div className="muted" style={{ fontSize: 12 }}>ORDER READY FOR</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{timeString}</div>
        <div className="muted" style={{ fontSize: 12 }}>{eta}</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 8 }}>
        <h3 style={{ margin: 0, letterSpacing: '.02em' }}>Your order</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {state.items.length > 0 ? <button onClick={clearCart} className="primary-btn" style={{ padding: '6px 10px', borderRadius: 8 }}>Clear</button> : null}
          <button onClick={onClose} aria-label="Close cart" title="Close" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }} className="danger hide-desktop">✕</button>
        </div>
      </div>

      {state.items.length === 0 ? (
        <div className="card animate-fadeInUp" style={{ textAlign: 'center', padding: 22, borderRadius: 'var(--radius)', border: '1px dashed var(--primary-600)', background: 'var(--primary-alpha-04)', color: 'var(--muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 6, color: 'var(--accent)' }}>🧾</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Your order is empty</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {state.items.map((item) => (
            <div key={item.id} className="card animate-fadeInUp" style={{ borderRadius: 'var(--radius-sm)', padding: 10, borderLeft: '3px solid var(--primary)' }}>
              <div style={{ display: 'flex', gap: 10 }}>
                {item.imageUrl ? <img src={item.imageUrl} alt={item.name} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }} /> : null}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{item.name}</div>
                  {item.variant ? (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Select Item: {item.variant.label || item.variant.key}
                      {Number(item?.variant?.price||0) > 0 ? ` (+$${Number(item.variant.price).toFixed(2)})` : ''}
                    </div>
                  ) : null}
                  {item.flavor ? (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Flavor: {item.flavor.label || item.flavor.key}
                      {Number(item?.flavor?.price||0) > 0 ? ` (+$${Number(item.flavor.price).toFixed(2)})` : ''}
                    </div>
                  ) : null}
                  {item.portion ? (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Portion: {item.portion.label || item.portion.key}
                      {Number(item?.portion?.price||0) > 0 ? ` (+$${Number(item.portion.price).toFixed(2)})` : ''}
                    </div>
                  ) : null}
                  {item.quantityOption ? (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Quantity: {item.quantityOption.label || item.quantityOption.key}
                      {Number(item?.quantityOption?.price||0) > 0 ? ` (+$${Number(item.quantityOption.price).toFixed(2)})` : ''}
                    </div>
                  ) : null}
                  {item.spiceLevel ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>Spice: {item.spiceLevel}</div> : null}
                  {item.selectedOptions.length > 0 ? (
                    <ul style={{ paddingLeft: 18, margin: '6px 0', color: 'var(--text)' }}>
                      {item.selectedOptions.map((opt) => (
                        <li key={`${opt.groupKey}:${opt.optionKey}`}>{opt.optionKey}{opt.priceDelta ? ` (+$${opt.priceDelta.toFixed(2)})` : ''}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}>-</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                    <div style={{ marginLeft: 'auto', fontWeight: 700 }}>${Number(item.totalPrice).toFixed(2)}</div>
                  </div>
                </div>
                <button onClick={() => removeItem(item.id)} title="Remove" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }} className="danger">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: 12, borderRadius: 'var(--radius-sm)', padding: 12 }}>
        {freeDeliveryEnabled && typeof freeDeliveryMinSubtotalCents === 'number' ? (
          <div
            className="animate-fadeInUp"
            style={{
              marginBottom: 10,
              padding: 10,
              borderRadius: 8,
              background: 'var(--primary-alpha-04)',
              border: '1px dashed var(--primary-600)'
            }}
          >
            {eligibleForFreeDelivery ? (
              <div style={{ fontSize: 12 }}><strong>Free delivery applied</strong> — delivery charge $0</div>
            ) : (
              <div style={{ fontSize: 12 }}>
                Free delivery over ${formatCents(freeDeliveryMinSubtotalCents)} — add ${formatCents(Math.max(0, Number(freeDeliveryMinSubtotalCents) - itemsSubtotalCents))} more
              </div>
            )}
          </div>
        ) : null}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          <span className="muted" style={{ fontSize: 12 }}>Coupon code</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., WELCOME10" style={{ flex: '1 1 160px', minWidth: 0 }} />
            <button disabled={checking || !code.trim()} style={{ flex: '0 0 auto' }} onClick={async () => {
              setCouponError('');
              const min = (Number(state.couponMinSubtotalCents) || 5000) / 100;
              if (subtotal < min) { setCouponError(`Minimum $${(min).toFixed(2)} subtotal required to apply discount`); return; }
              setChecking(true);
              try {
                const siteSlug = (window.location.pathname.match(/\/s\/([^/]+)/)?.[1]) || 'default';
                const res = await fetchJson(`/api/shop/${siteSlug}/coupon/${encodeURIComponent(code.trim())}`);
                if (res && typeof res.percent === 'number') {
                  applyCoupon(code.trim(), res.percent);
                } else {
                  setCouponError('Invalid code');
                }
              } catch (e) {
                setCouponError('Invalid code');
              } finally { setChecking(false); }
            }}>Apply</button>
            {state.coupon ? <button style={{ flex: '0 0 auto' }} onClick={() => { clearCoupon(); setCode(''); }}>Remove</button> : null}
          </div>
          {couponError ? <div style={{ color: 'var(--danger)', fontSize: 12 }}>{couponError}</div> : null}
          {state.coupon ? (
            <div className="muted" style={{ fontSize: 12 }}>
              Applied: {state.coupon.code} ({state.coupon.percent}% off)
              {subtotal < ((Number(state.couponMinSubtotalCents)||5000)/100) ? ` — Add items to reach $${((Number(state.couponMinSubtotalCents)||5000)/100).toFixed(2)} for discount` : ''}
            </div>
          ) : null}
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="muted" style={{ fontSize: 12 }}>Notes for restaurant</span>
          <textarea rows={3} placeholder="e.g., No onions, extra spicy" value={state.notes || ''} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="muted">Items</span>
            <span>${formatCents(itemsSubtotalCents)}</span>
          </div>
          {hasEligibleCoupon ? (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="muted">Discount ({state.coupon.percent}% )</span>
              <span>-${formatCents(discountCents)}</span>
            </div>
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="muted">Tax (5%)</span>
            <span>${formatCents(taxDisplayCents)}</span>
          </div>
          {state.fulfillmentType === 'delivery' ? (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="muted">Delivery Charge</span>
              <span>${formatCents(deliveryDisplayCents)}</span>
            </div>
          ) : null}
          <div style={{ height: 1, background: 'var(--border)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
            <span>Total</span>
            <span>${formatCents(grandTotalCents)}</span>
          </div>
        </div>
        <button
          type="button"
          className="primary-btn"
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid #b5835a',
            background: '#c7925a',
            color: '#fff',
            letterSpacing: '.03em',
            fontWeight: 900
          }}
          disabled={state.items.length === 0}
          onClick={() => {
            if (typeof onCheckout === 'function') {
              try { onCheckout(); } catch {}
            } else {
              try {
                const evt = new CustomEvent('cart:confirm');
                window.dispatchEvent(evt);
              } catch {}
            }
          }}
          aria-disabled={state.items.length === 0 ? 'true' : 'false'}
        >
          CHECKOUT
        </button>
      </div>
    </aside>
  );
};

