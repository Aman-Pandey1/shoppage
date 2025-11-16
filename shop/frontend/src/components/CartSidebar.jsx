import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../store/CartContext';
import { formatCents } from '../lib/money';
import { fetchJson } from '../lib/api';

export const CartSidebar = ({ open, onClose, onCheckout, readyAt }) => {
  const {
    state,
    removeItem,
    updateQuantity,
    clearCart,
    getCartTotal,
    setNotes,
    applyCoupon,
    clearCoupon,
    setCouponMinSubtotalCents,
    setDeliveryFeeCents
  } = useCart();
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

  const timeString = React.useMemo(
    () =>
      new Date(effectiveReadyAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }),
    [effectiveReadyAt]
  );

  const eta = React.useMemo(() => {
    const diffMs = new Date(effectiveReadyAt).getTime() - now;
    const mins = Math.max(0, Math.round(diffMs / 60000));
    return `(in ${mins} min)`;
  }, [effectiveReadyAt, now]);

  const subtotal = React.useMemo(
    () => state.items.reduce((s, it) => s + it.totalPrice, 0),
    [state.items]
  );

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
        const siteSlug =
          window.location.pathname.match(/\/s\/([^/]+)/)?.[1] || 'default';
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
        if (!autoTried && !state.coupon && subtotal >= min / 100) {
          const res = await fetchJson(`/api/shop/${siteSlug}/default-coupon`);
          if (
            !cancelled &&
            res &&
            res.code &&
            typeof res.percent === 'number' &&
            res.percent > 0
          ) {
            applyCoupon(res.code, res.percent);
            setCode(res.code);
          }
          if (!cancelled) setAutoTried(true);
        }
      } catch {} finally {
        // no-op: autoTried is set only when we attempted an auto-apply
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.items, state.coupon, applyCoupon, autoTried, state.couponMinSubtotalCents]);

  // Derived pricing (compute in cents to match backend/Stripe)
  const itemsSubtotalCents = React.useMemo(() => {
    return state.items.reduce((sum, it) => {
      const unitCents = Number.isFinite(it.unitCents)
        ? Math.max(0, Math.round(Number(it.unitCents)))
        : Math.round(
            ((Number(it.basePrice) || 0) +
              (Number(it?.variant?.price) || 0) +
              (Number(it.extraCost) || 0)) *
              100
          );
      return sum + unitCents * (Number(it.quantity) || 1);
    }, 0);
  }, [state.items]);

  const itemsSubtotal = React.useMemo(
    () => itemsSubtotalCents / 100,
    [itemsSubtotalCents]
  );

  // Coupon + delivery context
  const deliveryFeeCents =
    state.fulfillmentType === 'delivery'
      ? Number(state.deliveryFeeCents || 0)
      : 0;

  const eligibleForFreeDelivery = React.useMemo(() => {
    const min =
      typeof freeDeliveryMinSubtotalCents === 'number'
        ? freeDeliveryMinSubtotalCents
        : null;
    return !!freeDeliveryEnabled && min !== null && itemsSubtotalCents >= min;
  }, [freeDeliveryEnabled, freeDeliveryMinSubtotalCents, itemsSubtotalCents]);

  // Use the same cents-based eligibility as backend/site setting
  const hasEligibleCoupon = React.useMemo(() => {
    const minCents = Number(state.couponMinSubtotalCents) || 5000;
    return !!state.coupon && itemsSubtotalCents >= minCents;
  }, [state.coupon, itemsSubtotalCents, state.couponMinSubtotalCents]);

  const couponPct = hasEligibleCoupon
    ? Math.max(0, Math.min(100, Number(state.coupon.percent) || 0))
    : 0;

  // Items subtotal AFTER discount (per-LINE rounding) — matches backend/Stripe
  const itemsAfterDiscountCents = React.useMemo(() => {
    if (!hasEligibleCoupon || couponPct <= 0) return itemsSubtotalCents;
    return state.items.reduce((sum, it) => {
      const unitCents = Number.isFinite(it.unitCents)
        ? Math.max(0, Math.round(Number(it.unitCents)))
        : Math.round(
            ((Number(it.basePrice) || 0) +
              (Number(it?.variant?.price) || 0) +
              (Number(it.extraCost) || 0)) *
              100
          );
      const qty = Number(it.quantity) || 1;
      const lineCents = unitCents * qty;
      const discountedLine = Math.round((lineCents * (100 - couponPct)) / 100);
      return sum + discountedLine;
    }, 0);
  }, [state.items, itemsSubtotalCents, hasEligibleCoupon, couponPct]);

  // Actual tax to be charged is on discounted items
  const taxAfterDiscountCents = React.useMemo(
    () => Math.round(itemsAfterDiscountCents * 0.05),
    [itemsAfterDiscountCents]
  );

  // Display tax and delivery exactly as charged (no gross-up)
  const taxDisplayCents = taxAfterDiscountCents;

  const deliveryDisplayCents = React.useMemo(() => {
    if (state.fulfillmentType === 'delivery' && eligibleForFreeDelivery) return 0;
    return deliveryFeeCents;
  }, [state.fulfillmentType, eligibleForFreeDelivery, deliveryFeeCents]);

  // Final payable total
  const grandTotalCents = React.useMemo(
    () =>
      Math.max(
        0,
        itemsAfterDiscountCents + taxAfterDiscountCents + deliveryDisplayCents
      ),
    [itemsAfterDiscountCents, taxAfterDiscountCents, deliveryDisplayCents]
  );

  // Displayed subtotal before discount and discount amount
  const displayedSubtotalCents = React.useMemo(
    () => itemsSubtotalCents + taxDisplayCents + deliveryDisplayCents,
    [itemsSubtotalCents, taxDisplayCents, deliveryDisplayCents]
  );

  // Discount applies to items only
  const discountCents = React.useMemo(
    () =>
      hasEligibleCoupon
        ? Math.max(0, itemsSubtotalCents - itemsAfterDiscountCents)
        : 0,
    [hasEligibleCoupon, itemsSubtotalCents, itemsAfterDiscountCents]
  );

  const discount = React.useMemo(() => discountCents / 100, [discountCents]);
  const tax = React.useMemo(() => taxDisplayCents / 100, [taxDisplayCents]);
  const deliveryFee = React.useMemo(
    () => deliveryDisplayCents / 100,
    [deliveryDisplayCents]
  );
  const grandTotal = React.useMemo(
    () => grandTotalCents / 100,
    [grandTotalCents]
  );

  return (
    <aside
      style={{
        position: 'fixed',
        top: 8,
        right: 0,
        bottom: 4,
        width: 'var(--cart-width, 360px)',
        background: '#f3f4f6',
        padding: 8,
        overflowY: 'auto',
        zIndex: 10000,
        borderLeft: '1px solid #e5e7eb',
        boxShadow: '-12px 0 30px rgba(15,23,42,0.12)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }}
      className="cart-sidebar"
      data-open={open ? 'true' : 'false'}
    >

    <h2 className=' text-2xl font-bold w-full flex justify-between items-center'>
      <span className=' text-xl'>Total</span>
      <span className=' text-green-600'>${formatCents(grandTotalCents)}</span>
    </h2>
      {/* Top header tile: ORDER READY FOR (time) and TOTAL */}
      <div
        className="card"
        style={{
          padding: 14,
          borderRadius: 16,
          marginBottom: 4,
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          boxShadow: '0 8px 18px rgba(15,23,42,0.06)'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            width: '100%',
            gap: 12
          }}
        >
          <div>
            <div
              className="muted"
              style={{
                fontSize: 11,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: '#9ca3af'
              }}
            >
              Order ready for
            </div>
            <div
              className="muted"
              style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}
            >
              {eta}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>

            <div
              style={{
                fontWeight: 900,
                fontSize: 20,
                color: '#111827',
                marginTop: 4
              }}
            >
            {timeString}
            </div>
          </div>
        </div>
      </div>

      {state.items.length === 0 ? (
        <div
          className="card empty-cart animate-fadeInUp"
          style={{
            textAlign: 'center',
            padding: 16,
            borderRadius: 16,
            background: '#ffffff',
            color: 'var(--muted)',
            border: '1px dashed #e5e7eb',
            boxShadow: '0 8px 18px rgba(15,23,42,0.06)'
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
              width: 54,
              height: 54,
              borderRadius: 999,
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              boxShadow: '0 6px 12px rgba(15,23,42,0.08)'
            }}
          >
            <ShoppingCart size={26} color="#4b5563" />
          </div>
          <div
            style={{
              fontWeight: 800,
              marginBottom: 4,
              color: '#111827',
              fontSize: 15
            }}
          >
            Your cart is{' '}
            <span
              style={{
                color: 'var(--danger)'
              }}
            >
              empty
            </span>
            .
          </div>
        </div>
      ) : (
        <div
        className=''
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}
        >
          {state.items.map((item) => (
            <div
              key={item.id}
              className="card animate-fadeInUp"
              style={{
                borderRadius: 14,
                padding: 10,
                border: '1px solid #e5e7eb',
                background: '#ffffff',
                boxShadow: '0 6px 14px rgba(15,23,42,0.05)',
                display: 'flex',
                gap: 10
              }}
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  style={{
                    width: 64,
                    height: 64,
                    objectFit: 'cover',
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    flexShrink: 0
                  }}
                />
              ) : null}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 4
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: '#111827',
                      flex: 1
                    }}
                  >
                    {item.name}
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    title="Remove"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: 14,
                      lineHeight: 1,
                      padding: 4,
                      borderRadius: 999,
                      color: '#ef4444',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    className="danger"
                  >
                    ✕
                  </button>
                </div>

                {item.variant ? (
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Select Item:{' '}
                    <span style={{ fontWeight: 500 }}>
                      {item.variant.label || item.variant.key}
                    </span>
                    {Number(item?.variant?.price || 0) > 0
                      ? ` (+$${Number(item.variant.price).toFixed(2)})`
                      : ''}
                  </div>
                ) : null}
                {item.flavor ? (
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Flavor:{' '}
                    <span style={{ fontWeight: 500 }}>
                      {item.flavor.label || item.flavor.key}
                    </span>
                    {Number(item?.flavor?.price || 0) > 0
                      ? ` (+$${Number(item.flavor.price).toFixed(2)})`
                      : ''}
                  </div>
                ) : null}
                {item.portion ? (
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Portion:{' '}
                    <span style={{ fontWeight: 500 }}>
                      {item.portion.label || item.portion.key}
                    </span>
                    {Number(item?.portion?.price || 0) > 0
                      ? ` (+$${Number(item.portion.price).toFixed(2)})`
                      : ''}
                  </div>
                ) : null}
                {item.quantityOption ? (
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Quantity:{' '}
                    <span style={{ fontWeight: 500 }}>
                      {item.quantityOption.label || item.quantityOption.key}
                    </span>
                    {Number(item?.quantityOption?.price || 0) > 0
                      ? ` (+$${Number(item.quantityOption.price).toFixed(2)})`
                      : ''}
                  </div>
                ) : null}
                {item.spiceLevel ? (
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Spice: <span style={{ fontWeight: 500 }}>{item.spiceLevel}</span>
                  </div>
                ) : null}

                {item.selectedOptions.length > 0 ? (
                  <ul
                    style={{
                      paddingLeft: 16,
                      margin: '4px 0 4px',
                      color: '#374151',
                      fontSize: 12,
                      display: 'grid',
                      gap: 2
                    }}
                  >
                    {item.selectedOptions.map((opt) => (
                      <li
                        key={
                          opt.optionPath ||
                          `${opt.groupKey}:${opt.optionKey}`
                        }
                      >
                        <span style={{ fontWeight: 600 }}>
                          {opt.groupLabel || opt.groupKey}:
                        </span>{' '}
                        {opt.optionLabel || opt.optionKey}
                        {opt.priceDelta
                          ? ` (+$${opt.priceDelta.toFixed(2)})`
                          : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 6
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      borderRadius: 999,
                      border: '1px solid #e5e7eb',
                      background: '#f9fafb',
                      padding: '2px 4px',
                      gap: 4
                    }}
                  >
                    <button
                      onClick={() =>
                        updateQuantity(item.id, Math.max(1, item.quantity - 1))
                      }
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        fontSize: 14,
                        color: '#4b5563'
                      }}
                    >
                      -
                    </button>
                    <span
                      style={{
                        minWidth: 20,
                        textAlign: 'center',
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#111827'
                      }}
                    >
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateQuantity(item.id, item.quantity + 1)
                      }
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        fontSize: 14,
                        color: '#4b5563'
                      }}
                    >
                      +
                    </button>
                  </div>
                  <div
                    style={{
                      marginLeft: 'auto',
                      fontWeight: 700,
                      color: '#111827',
                      fontSize: 14
                    }}
                  >
                    ${Number(item.totalPrice).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        className="card"
        style={{
          marginTop: 2,
          borderRadius: 16,
          padding: 12,
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          boxShadow: '0 8px 20px rgba(15,23,42,0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}
      >
        {freeDeliveryEnabled && typeof freeDeliveryMinSubtotalCents === 'number' ? (
          <div
            className="animate-fadeInUp"
            style={{
              marginBottom: 4,
              padding: 10,
              borderRadius: 12,
              background: '#ecfdf3',
              border: '1px dashed #4ade80',
              color: '#166534',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            {eligibleForFreeDelivery ? (
              <div>
                <strong>Free delivery applied</strong> — delivery charge $0
              </div>
            ) : (
              <div>
                Free delivery over ${formatCents(freeDeliveryMinSubtotalCents)} — add $
                {formatCents(
                  Math.max(
                    0,
                    Number(freeDeliveryMinSubtotalCents) - itemsSubtotalCents
                  )
                )}{' '}
                more
              </div>
            )}
          </div>
        ) : null}

        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            marginBottom: 6
          }}
        >
          <span
            className="muted"
            style={{
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              color: '#6b7280'
            }}
          >
            Coupon code
          </span>
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap'
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g., WELCOME10"
              style={{
                flex: '1 1 160px',
                minWidth: 0,
                background: '#ffffff',
                borderRadius: 999,
                border: '1px solid #d1d5db',
                padding: '8px 12px',
                fontSize: 13,
                color: '#111827',
                outline: 'none'
              }}
            />
            <button
              disabled={checking || !code.trim()}
              style={{
                flex: '0 0 auto',
                borderRadius: 999,
                border: '1px solid #f59e0b',
                background: '#fbbf24',
                color: '#78350f',
                fontWeight: 700,
                fontSize: 12,
                padding: '8px 14px',
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                cursor: checking || !code.trim() ? 'not-allowed' : 'pointer',
                opacity: checking || !code.trim() ? 0.6 : 1,
                boxShadow: '0 4px 10px rgba(245,158,11,0.35)'
              }}
              onClick={async () => {
                setCouponError('');
                const min =
                  (Number(state.couponMinSubtotalCents) || 5000) / 100;
                if (subtotal < min) {
                  setCouponError(
                    `Minimum $${min.toFixed(
                      2
                    )} subtotal required to apply discount`
                  );
                  return;
                }
                setChecking(true);
                try {
                  const siteSlug =
                    window.location.pathname.match(/\/s\/([^/]+)/)?.[1] ||
                    'default';
                  const res = await fetchJson(
                    `/api/shop/${siteSlug}/coupon/${encodeURIComponent(
                      code.trim()
                    )}`
                  );
                  if (res && typeof res.percent === 'number') {
                    applyCoupon(code.trim(), res.percent);
                  } else {
                    setCouponError('Invalid code');
                  }
                } catch (e) {
                  setCouponError('Invalid code');
                } finally {
                  setChecking(false);
                }
              }}
            >
              Apply
            </button>
            {state.coupon ? (
              <button
                style={{
                  flex: '0 0 auto',
                  borderRadius: 999,
                  border: '1px solid #fecaca',
                  background: '#fef2f2',
                  color: '#b91c1c',
                  fontWeight: 600,
                  fontSize: 12,
                  padding: '8px 12px',
                  textTransform: 'uppercase',
                  letterSpacing: '.08em',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  clearCoupon();
                  setCode('');
                }}
              >
                Remove
              </button>
            ) : null}
          </div>
          {couponError ? (
            <div
              style={{
                color: 'var(--danger)',
                fontSize: 11,
                marginTop: 4
              }}
            >
              {couponError}
            </div>
          ) : null}
          {state.coupon ? (
            <div
              className="muted"
              style={{
                fontSize: 12,
                color: '#6b7280'
              }}
            >
              Applied: <strong>{state.coupon.code}</strong> (
              {state.coupon.percent}% off)
              {subtotal <
              (Number(state.couponMinSubtotalCents) || 5000) / 100
                ? ` — Add items to reach $${(
                    (Number(state.couponMinSubtotalCents) || 5000) /
                    100
                  ).toFixed(2)} for discount`
                : ''}
            </div>
          ) : null}
        </label>

        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}
        >
          <span
            className="muted"
            style={{
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              color: '#6b7280'
            }}
          >
            Notes for restaurant
          </span>
          <textarea
            rows={3}
            placeholder="e.g., No onions, extra spicy"
            value={state.notes || ''}
            onChange={(e) => setNotes(e.target.value)}
            style={{
              background: '#ffffff',
              borderRadius: 12,
              border: '1px solid #d1d5db',
              padding: 8,
              fontSize: 13,
              color: '#111827',
              resize: 'vertical',
              minHeight: 64,
              outline: 'none'
            }}
          />
        </label>

        <div
          style={{
            display: 'grid',
            gap: 6,
            marginTop: 8,
            padding: 10,
            borderRadius: 12,
            background: '#f9fafb',
            border: '1px solid #e5e7eb'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13
            }}
          >
            <span className="muted" style={{ color: '#6b7280' }}>
              Items
            </span>
            <span style={{ color: '#111827' }}>
              ${formatCents(itemsSubtotalCents)}
            </span>
          </div>

          {hasEligibleCoupon ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: '#166534'
              }}
            >
              <span className="muted">
                Discount ({state.coupon.percent}% )
              </span>
              <span>- ${formatCents(discountCents)}</span>
            </div>
          ) : null}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12
            }}
          >
            <span className="muted" style={{ color: '#6b7280' }}>
              Tax (5%)
            </span>
            <span style={{ color: '#111827' }}>
              ${formatCents(taxDisplayCents)}
            </span>
          </div>

          {state.fulfillmentType === 'delivery' ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12
              }}
            >
              <span
                className="muted"
                style={{ color: '#6b7280' }}
              >
                Delivery charge
              </span>
              <span style={{ color: '#111827' }}>
                ${formatCents(deliveryDisplayCents)}
              </span>
            </div>
          ) : null}

          <div
            style={{
              height: 1,
              background:
                'linear-gradient(90deg, transparent, #d1d5db, transparent)',
              marginTop: 2,
              marginBottom: 2
            }}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 800,
              fontSize: 14,
              color: '#111827'
            }}
          >
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
            borderRadius: 999,
            border: '1px solid #ea580c',
            background: 'linear-gradient(135deg, #fb923c, #f97316)',
            color: '#ffffff',
            letterSpacing: '.12em',
            fontWeight: 900,
            fontSize: 13,
            textTransform: 'uppercase',
            marginTop: 4,
            boxShadow:
              '0 10px 20px rgba(249,115,22,0.45), 0 0 0 1px rgba(124,45,18,0.3)',
            cursor: state.items.length === 0 ? 'not-allowed' : 'pointer',
            opacity: state.items.length === 0 ? 0.6 : 1
          }}
          disabled={state.items.length === 0}
          onClick={() => {
            if (typeof onCheckout === 'function') {
              try {
                onCheckout();
              } catch {}
            } else {
              try {
                const evt = new CustomEvent('cart:confirm');
                window.dispatchEvent(evt);
              } catch {}
            }
          }}
          aria-disabled={state.items.length === 0 ? 'true' : 'false'}
        >
          Checkout
        </button>
      </div>
    </aside>
  );
};
