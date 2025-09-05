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
};

export type ExtraOptionGroup = {
  groupKey: string;
  groupLabel: string;
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
  spiceLevels?: string[];
  extraOptionGroups?: ExtraOptionGroup[];
};

export type Site = {
  _id: string;
  name: string;
  slug: string;
  domains?: string[];
  isActive: boolean;
};

export type FulfillmentType = 'pickup' | 'delivery';

export type SelectedOption = {
  groupKey: string;
  optionKey: string;
  priceDelta?: number;
};

export type CartItem = {
  id: string;
  productId: string;
  name: string;
  basePrice: number;
  quantity: number;
  spiceLevel?: string;
  selectedOptions: SelectedOption[];
  extraCost: number;
  totalPrice: number;
  imageUrl?: string;
};

export type CartState = {
  items: CartItem[];
  fulfillmentType?: FulfillmentType;
};