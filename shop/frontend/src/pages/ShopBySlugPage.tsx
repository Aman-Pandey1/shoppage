import React from 'react';
import { useParams } from 'react-router-dom';
import { CartProvider } from '../store/CartContext';
import { ShopApp } from '../ShopApp';

export const ShopBySlugPage: React.FC = () => {
  const { siteSlug = 'default' } = useParams();
  const storageKey = `shop_cart_state_v1:${siteSlug}`;
  return (
    <CartProvider storageKey={storageKey}>
      <ShopApp siteSlug={siteSlug} />
    </CartProvider>
  );
};

