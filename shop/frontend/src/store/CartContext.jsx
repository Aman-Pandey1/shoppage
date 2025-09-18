import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const DEFAULT_STORAGE_KEY = 'shop_cart_state_v1';

const CartContext = createContext(undefined);

function calculateExtraCost(selectedOptions) {
  return (selectedOptions || []).reduce((sum, opt) => sum + (opt.priceDelta || 0), 0);
}

function generateItemId(productId, spiceLevel, selectedOptions) {
  const optsKey = (selectedOptions || [])
    .slice()
    .sort((a, b) => `${a.groupKey}:${a.optionKey}`.localeCompare(`${b.groupKey}:${b.optionKey}`))
    .map((o) => `${o.groupKey}:${o.optionKey}`)
    .join('|');
  return `${productId}__${spiceLevel || ''}__${optsKey}`;
}

export const CartProvider = ({ children, storageKey = DEFAULT_STORAGE_KEY }) => {
  const [state, setState] = useState({ items: [] });
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
    setState((prev) => ({ ...prev, fulfillmentType: type }));
  }, []);

  const addItem = useCallback(({ product, quantity = 1, spiceLevel, selectedOptions = [] }) => {
    const extraCost = calculateExtraCost(selectedOptions);
    const totalPrice = (product.price + extraCost) * quantity;
    const id = generateItemId(product._id, spiceLevel, selectedOptions);
    const newItem = {
      id,
      productId: product._id,
      name: product.name,
      basePrice: product.price,
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
        updated[existingIndex] = {
          ...existing,
          quantity: newQuantity,
          totalPrice: (existing.basePrice + existing.extraCost) * newQuantity,
        };
        return { ...prev, items: updated };
      }
      return { ...prev, items: [...prev.items, newItem] };
    });
    setLastAdded({ name: product.name, quantity, price: (product.price + extraCost), imageUrl: product.imageUrl });
  }, []);

  const removeItem = useCallback((id) => {
    setState((prev) => ({ ...prev, items: prev.items.filter((it) => it.id !== id) }));
  }, []);

  const updateQuantity = useCallback((id, quantity) => {
    setState((prev) => {
      const updated = prev.items.map((it) => (it.id === id ? { ...it, quantity, totalPrice: (it.basePrice + it.extraCost) * quantity } : it));
      return { ...prev, items: updated };
    });
  }, []);

  const clearCart = useCallback(() => setState((prev) => ({ ...prev, items: [] })), []);

  const getCartTotal = useCallback(() => {
    return state.items.reduce((sum, it) => sum + it.totalPrice, 0);
  }, [state.items]);

  const value = useMemo(
    () => ({ state, setFulfillmentType, addItem, removeItem, updateQuantity, clearCart, getCartTotal, lastAdded }),
    [state, setFulfillmentType, addItem, removeItem, updateQuantity, clearCart, getCartTotal, lastAdded]
  );

  return (<CartContext.Provider value={value}>{children}</CartContext.Provider>);
};

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

