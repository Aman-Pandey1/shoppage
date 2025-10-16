// Shared pricing calculations to keep Cart and Checkout consistent
// All calculations are performed in cents to avoid floating-point drift

export function computePricing({ items = [], deliveryFeeCents = 0, coupon = null, couponMinSubtotalCents = 5000, taxRate = 0.05 }) {
  const normalizedItems = Array.isArray(items)
    ? items.map((it) => ({
        priceCents: Math.max(0, Math.round(Number(it.priceCents) || 0)),
        quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
      }))
    : [];

  const itemsSubtotalCents = normalizedItems.reduce((sum, it) => sum + it.priceCents * it.quantity, 0);
  const hasEligibleCoupon = !!coupon && itemsSubtotalCents >= Math.max(0, Math.round(Number(couponMinSubtotalCents) || 0));
  const pct = hasEligibleCoupon ? Math.max(0, Math.min(100, Number(coupon?.percent) || 0)) : 0;
  const discountFactor = pct > 0 ? (1 - pct / 100) : 1;

  const itemsAfterDiscountCents = (pct > 0)
    ? normalizedItems.reduce((sum, it) => {
        const discountedUnit = Math.round(it.priceCents * (100 - pct) / 100);
        return sum + discountedUnit * it.quantity;
      }, 0)
    : itemsSubtotalCents;

  const taxAfterDiscountCents = Math.round(itemsAfterDiscountCents * taxRate);
  const deliveryCents = Math.max(0, Math.round(Number(deliveryFeeCents) || 0));
  const grandTotalCents = Math.max(0, itemsAfterDiscountCents + taxAfterDiscountCents + deliveryCents);

  // For UI display to mirror Stripe (show explicit Discount line): gross-up tax and delivery
  const taxDisplayCents = pct > 0 ? Math.round(taxAfterDiscountCents / discountFactor) : taxAfterDiscountCents;
  const deliveryDisplayCents = (deliveryCents > 0 && pct > 0) ? Math.round(deliveryCents / discountFactor) : deliveryCents;
  const displayedSubtotalCents = itemsSubtotalCents + taxDisplayCents + deliveryDisplayCents;
  const discountCents = pct > 0 ? Math.max(0, displayedSubtotalCents - grandTotalCents) : 0;

  return {
    hasEligibleCoupon,
    couponPercent: pct,
    discountFactor,
    cents: {
      itemsSubtotal: itemsSubtotalCents,
      itemsAfterDiscount: itemsAfterDiscountCents,
      taxAfterDiscount: taxAfterDiscountCents,
      taxDisplay: taxDisplayCents,
      delivery: deliveryCents,
      deliveryDisplay: deliveryDisplayCents,
      displayedSubtotal: displayedSubtotalCents,
      discount: discountCents,
      grandTotal: grandTotalCents,
    },
    dollars: {
      itemsSubtotal: itemsSubtotalCents / 100,
      itemsAfterDiscount: itemsAfterDiscountCents / 100,
      taxAfterDiscount: taxAfterDiscountCents / 100,
      taxDisplay: taxDisplayCents / 100,
      delivery: deliveryDisplayCents / 100, // for UI we show the display value
      deliveryRaw: deliveryCents / 100,
      displayedSubtotal: displayedSubtotalCents / 100,
      discount: discountCents / 100,
      grandTotal: grandTotalCents / 100,
    },
  };
}
