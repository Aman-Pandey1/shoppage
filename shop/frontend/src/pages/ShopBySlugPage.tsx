import React from 'react';
import { useParams } from 'react-router-dom';
import { CartProvider } from '../store/CartContext';
import { ShopBySlugView } from '../sections/ShopBySlugView';

export const ShopBySlugPage: React.FC = () => {
  const { siteSlug = 'default' } = useParams();
  return (
    <CartProvider>
      <ShopBySlugView siteSlug={siteSlug} />
    </CartProvider>
  );
};

