export type Category = {
  _id: string;
  name: string;
  imageUrl: string;
  sortIndex?: number;
};

export type ProductOption = {
  key: string;
  label: string;
  priceDelta?: number;
  description?: string;
  isDefault?: boolean;
};

export type ExtraOptionGroup = {
  groupKey: string;
  groupLabel: string;
  helpText?: string;
  selectionType?: 'single' | 'multi';
  isRequired?: boolean;
  minSelect?: number;
  maxSelect?: number;
  options: ProductOption[];
};

export type Product = {
  _id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price: number;
  categoryId: string;
  isVeg?: boolean;
  spiceLevels?: string[];
  // Optional variants on the product
  variants?: Array<{
    key: string;
    label: string;
    // Add-on price that is added to base price when selected
    price?: number;
  }>;
  // Optional flavors on the product
  flavors?: Array<{
    key: string;
    label: string;
    price?: number;
  }>;
  // Optional portions on the product
  portions?: Array<{
    key: string;
    label: string;
    price?: number;
  }>;
  // Optional quantity choices (labelled like 250g/500g/1kg)
  quantities?: Array<{
    key: string;
    label: string;
    price?: number;
  }>;
  extraOptionGroups?: ExtraOptionGroup[];
};

export type Site = {
  _id: string;
  name: string;
  slug: string;
  domains?: string[];
  isActive: boolean;
  brandColor?: string;
  uberCustomerId?: string;
  pickup?: {
    name?: string;
    phone?: string;
    address?: {
      streetAddress: string[];
      city: string;
      province: string;
      postalCode: string;
      country?: string;
    }
  };
};

export type FulfillmentType = 'pickup' | 'delivery';

export type SelectedOption = {
  groupKey: string;
  groupLabel?: string;
  optionKey: string;
  optionLabel?: string;
  priceDelta?: number;
};

export type CartItem = {
  id: string;
  productId: string;
  name: string;
  basePrice: number;
  quantity: number;
  spiceLevel?: string;
  variant?: { key: string; label?: string; price?: number };
  flavor?: { key: string; label?: string; price?: number };
  portion?: { key: string; label?: string; price?: number };
  quantityOption?: { key: string; label?: string; price?: number };
  selectedOptions: SelectedOption[];
  extraCost: number;
  totalPrice: number;
  imageUrl?: string;
};

export type CartState = {
  items: CartItem[];
  fulfillmentType?: FulfillmentType;
};