import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const DEFAULT_STORAGE_KEY = 'shop_cart_state_v1';

const CartContext = createContext(undefined);

function calculateExtraCost(selectedOptions) {
  return (selectedOptions || []).reduce((sum, opt) => sum + (opt.priceDelta || 0), 0);
}

function formatOptionsSummary(product, spiceLevel, selectedOptions, variant) {
  try {
    const groups = Array.isArray(product?.extraOptionGroups) ? product.extraOptionGroups : [];
    const groupKeyToLabel = new Map(groups.map((g) => [g.groupKey, g.groupLabel || g.groupKey]));
    const groupKeyToOptions = new Map(groups.map((g) => [g.groupKey, new Map((g.options || []).map((o) => [o.key, o.label || o.key]))]));

    const perGroupSelections = new Map();
    (selectedOptions || []).forEach((opt) => {
      const labelMap = groupKeyToOptions.get(opt.groupKey);
      const optionLabel = labelMap ? (labelMap.get(opt.optionKey) || opt.optionKey) : opt.optionKey;
      if (!perGroupSelections.has(opt.groupKey)) perGroupSelections.set(opt.groupKey, []);
      perGroupSelections.get(opt.groupKey).push(optionLabel);
    });

    const parts = [];
    if (variant && (variant.label || variant.key)) parts.push(`Size: ${variant.label || variant.key}`);
    if (spiceLevel) parts.push(`Spice: ${spiceLevel}`);
    for (const [gk, labels] of perGroupSelections.entries()) {
      const glabel = groupKeyToLabel.get(gk) || gk;
      parts.push(`${glabel}: ${labels.join(', ')}`);
    }
    const summary = parts.join(' • ');
    return summary || undefined;
  } catch {
    return undefined;
  }
}

function generateItemId(productId, spiceLevel, selectedOptions, variant) {
  const optsKey = (selectedOptions || [])
    .slice()
    .sort((a, b) => `${a.groupKey}:${a.optionKey}`.localeCompare(`${b.groupKey}:${b.optionKey}`))
    .map((o) => `${o.groupKey}:${o.optionKey}`)
    .join('|');
  const variantKey = variant?.key || '';
  return `${productId}__${variantKey}__${spiceLevel || ''}__${optsKey}`;
}

export const CartProvider = ({ children, storageKey = DEFAULT_STORAGE_KEY }) => {
  const [state, setState] = useState({
    items: [],
    notes: '',
    coupon: null,
    fulfillmentType: undefined,
    deliveryFeeCents: 0,
    // Minimum items subtotal (in cents) required to apply coupons; site-configurable
    couponMinSubtotalCents: 5000,
  });
  const [lastAdded, setLastAdded] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setState(parsed);
      }
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {}
  }, [state, storageKey]);

  const setFulfillmentType = useCallback((type) => {
    setState((prev) => ({
      ...prev,
      fulfillmentType: type,
      // Clear delivery fee when switching away from delivery
      deliveryFeeCents: type === 'delivery' ? prev.deliveryFeeCents : 0,
    }));
  }, []);

  const setDeliveryFeeCents = useCallback((cents) => {
    const value = Math.max(0, Math.round(Number(cents) || 0));
    setState((prev) => ({ ...prev, deliveryFeeCents: value }));
  }, []);

  const setCouponMinSubtotalCents = useCallback((cents) => {
    const value = Math.max(0, Math.round(Number(cents) || 0));
    setState((prev) => ({ ...prev, couponMinSubtotalCents: value }));
  }, []);

  const setNotes = useCallback((text) => {
    setState((prev) => ({ ...prev, notes: String(text || '').slice(0, 1000) }));
  }, []);

  const applyCoupon = useCallback((code, percent) => {
    const normalized = String(code || '').trim().toUpperCase();
    const pct = Math.max(0, Math.min(100, Number(percent) || 0));
    setState((prev) => ({ ...prev, coupon: normalized && pct > 0 ? { code: normalized, percent: pct } : null }));
  }, []);

  const clearCoupon = useCallback(() => setState((prev) => ({ ...prev, coupon: null })), []);

  const addItem = useCallback(({ product, quantity = 1, spiceLevel, selectedOptions = [], variant = null }) => {
    const extraCost = calculateExtraCost(selectedOptions);
    const variantAddon = Number(variant?.price || 0);
    const unitPrice = Number(product.price || 0) + variantAddon + extraCost;
    const totalPrice = unitPrice * quantity;
    const id = generateItemId(product._id, spiceLevel, selectedOptions, variant);
    const newItem = {
      id,
      productId: product._id,
      name: product.name,
      basePrice: product.price,
      variant,
      quantity,
      spiceLevel,
      selectedOptions,
      extraCost,
      totalPrice,
      imageUrl: product.imageUrl,
    };

    setState((prev) => {
      const existingIndex = prev.items.findIndex((it) => it.id === id);
      if (existingIndex >= 0) {
        const updated = prev.items.slice();
        const existing = updated[existingIndex];
        const newQuantity = existing.quantity + quantity;
        const addon = Number(existing?.variant?.price || 0);
        const existingUnit = Number(existing.basePrice || 0) + addon + Number(existing.extraCost || 0);
        updated[existingIndex] = {
          ...existing,
          quantity: newQuantity,
          totalPrice: existingUnit * newQuantity,
        };
        return { ...prev, items: updated };
      }
      return { ...prev, items: [...prev.items, newItem] };
    });
    const optionsSummary = formatOptionsSummary(product, spiceLevel, selectedOptions, variant);
    const displayUnit = Number(product.price || 0) + Number(variant?.price || 0) + extraCost;
    setLastAdded({ name: product.name, quantity, price: displayUnit, imageUrl: product.imageUrl, optionsSummary });
  }, []);

  const removeItem = useCallback((id) => {
    setState((prev) => ({ ...prev, items: prev.items.filter((it) => it.id !== id) }));
  }, []);

  const updateQuantity = useCallback((id, quantity) => {
    setState((prev) => {
      const updated = prev.items.map((it) => {
        if (it.id !== id) return it;
        const addon = Number(it?.variant?.price || 0);
        const unit = Number(it.basePrice || 0) + addon + Number(it.extraCost || 0);
        return { ...it, quantity, totalPrice: unit * quantity };
      });
      return { ...prev, items: updated };
    });
  }, []);

  const clearCart = useCallback(() => setState((prev) => ({ ...prev, items: [] })), []);

  const getCartTotal = useCallback(() => {
    const itemsSubtotalCents = state.items.reduce((sum, it) => {
      const unitPrice = (Number(it.basePrice) || 0) + (Number(it?.variant?.price) || 0) + (Number(it.extraCost) || 0);
      const unitCents = Math.round(unitPrice * 100);
      return sum + unitCents * (Number(it.quantity) || 1);
    }, 0);
    const minCents = Number(state.couponMinSubtotalCents) || 5000;
    const isEligibleForCoupon = itemsSubtotalCents >= minCents;
    let discountedCents = itemsSubtotalCents;
    if (state.coupon && isEligibleForCoupon) {
      const pct = Math.max(0, Math.min(100, Number(state.coupon.percent) || 0));
      // Apply discount at LINE level (unitCents * qty) and then round.
      // This mirrors backend/Stripe rounding and prevents cent-level mismatches.
      discountedCents = state.items.reduce((sum, it) => {
        const unitPrice = (Number(it.basePrice) || 0) + (Number(it?.variant?.price) || 0) + (Number(it.extraCost) || 0);
        const unitCents = Math.round(unitPrice * 100);
        const qty = Number(it.quantity) || 1;
        const lineCents = unitCents * qty;
        const discountedLine = Math.round(lineCents * (100 - pct) / 100);
        return sum + discountedLine;
      }, 0);
    }
    return Math.max(0, discountedCents) / 100;
  }, [state.items, state.coupon]);

  const value = useMemo(
    () => ({
      state,
      setFulfillmentType,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      getCartTotal,
      lastAdded,
      setNotes,
      applyCoupon,
      clearCoupon,
      setDeliveryFeeCents,
      setCouponMinSubtotalCents,
    }),
    [state, setFulfillmentType, addItem, removeItem, updateQuantity, clearCart, getCartTotal, lastAdded, setNotes, applyCoupon, clearCoupon]
  );

  return (<CartContext.Provider value={value}>{children}</CartContext.Provider>);
};

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

