import React, { useEffect, useMemo, useState } from 'react';
import { CartProvider, useCart } from './store/CartContext';
import { CartSidebar } from './components/CartSidebar';
import { CategoryGrid } from './components/CategoryGrid';
import { ProductList } from './components/ProductList';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
import { FulfillmentModal } from './components/FulfillmentModal';
import { SpiceModal } from './components/SpiceModal';
import { ExtrasModal } from './components/ExtrasModal';
import type { Category, Product, SelectedOption } from './types';

const Main: React.FC = () => {
  const { state, setFulfillmentType, addItem } = useCart();
  const [privacyOpen, setPrivacyOpen] = useState(true);
  const [fulfillmentOpen, setFulfillmentOpen] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [spiceOpen, setSpiceOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [pendingSpice, setPendingSpice] = useState<string | undefined>(undefined);

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

  const content = useMemo(() => {
    if (selectedCategory) {
      return (
        <ProductList
          category={selectedCategory}
          onAdd={startAddToCart}
          onBack={() => setSelectedCategory(null)}
        />
      );
    }
    return <CategoryGrid onSelect={setSelectedCategory} />;
  }, [selectedCategory]);

  return (
    <div>
      <CartSidebar />
      <main className="content" style={{ marginLeft: 340, padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>Shop</h2>
        {content}
      </main>

      <PrivacyPolicyModal open={privacyOpen} onAccept={handleAcceptPrivacy} />
      <FulfillmentModal open={fulfillmentOpen} onChoose={handleChooseFulfillment} />
      <SpiceModal open={spiceOpen} spiceLevels={pendingProduct?.spiceLevels} onCancel={() => setSpiceOpen(false)} onConfirm={confirmSpice} />
      <ExtrasModal open={extrasOpen} groups={pendingProduct?.extraOptionGroups} onCancel={() => setExtrasOpen(false)} onConfirm={confirmExtras} />
    </div>
  );
};

export const ShopApp: React.FC = () => {
  return (
    <CartProvider>
      <Main />
    </CartProvider>
  );
};