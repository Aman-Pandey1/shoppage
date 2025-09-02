import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CartItem, CartState, FulfillmentType, Product, SelectedOption } from '../types';

const STORAGE_KEY = 'shop_cart_state_v1';

type CartContextValue = {
  state: CartState;
  setFulfillmentType: (type: FulfillmentType) => void;
  addItem: (args: {
    product: Product;
    quantity?: number;
    spiceLevel?: string;
    selectedOptions?: SelectedOption[];
  }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

function calculateExtraCost(selectedOptions: SelectedOption[]): number {
  return selectedOptions.reduce((sum, opt) => sum + (opt.priceDelta || 0), 0);
}

function generateItemId(productId: string, spiceLevel?: string, selectedOptions?: SelectedOption[]): string {
  const optsKey = (selectedOptions || [])
    .slice()
    .sort((a, b) => `${a.groupKey}:${a.optionKey}`.localeCompare(`${b.groupKey}:${b.optionKey}`))
    .map((o) => `${o.groupKey}:${o.optionKey}`)
    .join('|');
  return `${productId}__${spiceLevel || ''}__${optsKey}`;
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<CartState>({ items: [] });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: CartState = JSON.parse(raw);
        setState(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const setFulfillmentType = useCallback((type: FulfillmentType) => {
    setState((prev) => ({ ...prev, fulfillmentType: type }));
  }, []);

  const addItem = useCallback(({ product, quantity = 1, spiceLevel, selectedOptions = [] }: { product: Product; quantity?: number; spiceLevel?: string; selectedOptions?: SelectedOption[] }) => {
    const extraCost = calculateExtraCost(selectedOptions);
    const totalPrice = (product.price + extraCost) * quantity;
    const id = generateItemId(product._id, spiceLevel, selectedOptions);
    const newItem: CartItem = {
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
  }, []);

  const removeItem = useCallback((id: string) => {
    setState((prev) => ({ ...prev, items: prev.items.filter((it) => it.id !== id) }));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
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
    () => ({ state, setFulfillmentType, addItem, removeItem, updateQuantity, clearCart, getCartTotal }),
    [state, setFulfillmentType, addItem, removeItem, updateQuantity, clearCart, getCartTotal]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}