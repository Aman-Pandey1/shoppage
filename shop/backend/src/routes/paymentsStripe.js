import { Router } from 'express';
import Stripe from 'stripe';
import fetch from 'node-fetch';
import { createDelivery as uberCreateDelivery } from '../services/uberDirect.js';
import { createDelivery as ddCreateDelivery } from '../services/doordashDrive.js';
import { sendOrderEmail } from '../utils/mailer.js';
import { tenantBySlug } from '../middleware/tenant.js';
import { requireUser } from '../middleware/auth.js';
import Order from '../models/Order.js';
import Coupon from '../models/Coupon.js';
import Site from '../models/Site.js';
import { calculateDistanceFeeCents, distanceBetweenAddressesKm } from '../services/geo.js';

const router = Router();

// Helper: Notify external API after order events (default to Blueboxx backend)
const ORDER_NOTIFY_URL = process.env.ORDER_NOTIFY_URL || 'https://blueboxx-backend.onrender.com/api/order/notify';
function buildNotifyPayload(order, siteName) {
  return {
    _id: String(order?._id || ''),
    site: siteName || '',
    userId: order?.userId ? String(order.userId) : undefined,
    userEmail: order?.userEmail || '',
    fulfillmentType: order?.fulfillmentType,
    items: (order?.items || []).map((m) => ({
      name: m.name,
      quantity: m.quantity,
      priceCents: m.priceCents,
      spiceLevel: m.spiceLevel,
    })),
    totalCents: order?.totalCents,
    taxCents: order?.taxCents,
    tipCents: typeof order?.tipCents === 'number' ? order.tipCents : 0,
    deliveryFeeCents: typeof order?.deliveryFeeCents === 'number' ? order.deliveryFeeCents : 0,
    deliveryFeeRestaurantCents: typeof order?.deliveryFeeRestaurantCents === 'number' ? order.deliveryFeeRestaurantCents : 0,
    notes: order?.notes || '',
    status: order?.status,
    pickup: order?.pickup,
    dropoff: order?.dropoff,
    meta: order?.meta,
    createdAt: order?.createdAt,
    updatedAt: order?.updatedAt,
    externalId: order?.externalId,
  };
}
async function sendOrderNotify(order, siteName) {
  try {
    const payload = buildNotifyPayload(order, siteName);
    await fetch(ORDER_NOTIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {}
}

// Stripe payment confirmation fallback.
// Called by frontend after redirect from Stripe (success_url contains cs={CHECKOUT_SESSION_ID}).
router.get('/confirm/:sessionId', async (req, res) => {
  try {
    const sessionId = String(req.params.sessionId || '').trim();
    if (!sessionId) return res.status(400).json({ error: 'Missing session id' });
    // Try to resolve site from order by externalId to use per-site Stripe key if configured
    let siteForClient = null;
    try {
      const byExternal = await Order.findOne({ externalId: sessionId });
      if (byExternal) {
        siteForClient = await Site.findById(byExternal.site);
      }
    } catch {}
    const stripe = getStripeClient(siteForClient);

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const paid = (session.payment_status === 'paid') || (session.status === 'complete');
    const orderId = session.metadata?.orderId;
    const siteId = session.metadata?.siteId;
    if (!orderId || !siteId) return res.status(400).json({ error: 'Missing order or site metadata' });

    let updatedOrder = null;
    if (paid) {
      // Mark order paid
      updatedOrder = await Order.findByIdAndUpdate(orderId, { status: 'paid' }, { new: true });
      if (updatedOrder && updatedOrder.fulfillmentType === 'delivery' && !updatedOrder.uberDeliveryId) {
        // Create delivery now (same logic as webhook)
        const site = await Site.findById(updatedOrder.site);
        if (updatedOrder?.dropoff && updatedOrder?.pickup?.location && site) {
          const provider = site.deliveryProvider || 'uber';
          let delivery = null;
          if (provider === 'doordash' && site.doordashStoreId) {
            delivery = await ddCreateDelivery({
              storeId: site.doordashStoreId,
              pickup: updatedOrder.pickup.location,
              dropoff: updatedOrder.dropoff,
              manifestItems: (updatedOrder.items || []).map((m) => ({ name: m.name, quantity: m.quantity, size: m.size, price: m.priceCents, spiceLevel: m.spiceLevel })),
              tip: 0,
              externalId: String(updatedOrder._id),
            });
          } else if (site.uberCustomerId) {
            delivery = await uberCreateDelivery({
              customerId: site.uberCustomerId,
              pickup: updatedOrder.pickup.location,
              dropoff: updatedOrder.dropoff,
              manifestItems: (updatedOrder.items || []).map((m) => ({ name: m.name, quantity: m.quantity, size: m.size, price: m.priceCents, spiceLevel: m.spiceLevel })),
              tip: 0,
              externalId: String(updatedOrder._id),
              creds: { clientId: site?.uberClientId, clientSecret: site?.uberClientSecret, env: site?.uberEnv }
            });
          }
          if (delivery) {
            const trackingUrl = delivery?.tracking_url || delivery?.trackingUrl || delivery?.share_url || '';
            const status = delivery?.status || delivery?.state || delivery?.current_status || '';
            await Order.findByIdAndUpdate(updatedOrder._id, { uberDeliveryId: delivery?.id || delivery?.delivery_id, uberTrackingUrl: trackingUrl, uberStatus: status });
          }
        }
      }
      try {
        const site = await Site.findById(siteId);
        await sendOrderEmail({ to: updatedOrder?.userEmail, siteName: site?.name || '', orderId: updatedOrder?._id, items: updatedOrder?.items, totalCents: updatedOrder?.totalCents, deliveryFeeCents: updatedOrder?.deliveryFeeCents, fulfillmentType: updatedOrder?.fulfillmentType, trackingUrl: updatedOrder?.uberTrackingUrl });
        await sendOrderNotify(updatedOrder, site?.name || '');
      } catch {}
    }

    return res.json({ ok: true, paid, orderId });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Resolve by :slug for all endpoints here
router.use('/:slug', tenantBySlug);

function getStripeClient(site) {
  const siteSecret = site?.stripeSecretKey;
  const secret = siteSecret || process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error('Missing STRIPE_SECRET_KEY');
  return new Stripe(secret);
}

function getCurrency() {
  const cur = (process.env.STRIPE_CURRENCY || 'usd').toLowerCase();
  return cur;
}

// Create Stripe Checkout session for a pickup order
router.post('/:slug/checkout/pickup', requireUser, async (req, res) => {
  try {
    const stripe = getStripeClient(req.site);
    const currency = getCurrency();
    const { items = [], pickup, notes, coupon } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items required' });
    }

    // Compute items subtotal in cents
    const itemsSubtotal = items.reduce((sum, it) => sum + (Number(it.priceCents) || 0) * (Number(it.quantity) || 1), 0);
    const COUPON_MIN_SUBTOTAL_CENTS = Math.max(0, Number(process.env.COUPON_MIN_SUBTOTAL_CENTS) || 5000);
    const subtotalBeforeDiscount = itemsSubtotal;

    // Validate coupon (do not change unit prices here; we'll use Stripe discounts so it shows explicitly)
    let appliedCoupon = null;
    const code = coupon?.code ? String(coupon.code).trim().toUpperCase() : null;
    const pct = typeof coupon?.percent === 'number' ? Math.max(0, Math.min(100, Number(coupon.percent) || 0)) : null;
    const mock = req.app.locals.mockData;
    if (code && typeof pct === 'number' && subtotalBeforeDiscount >= COUPON_MIN_SUBTOTAL_CENTS) {
      if (mock) {
        const found = (mock.coupons || []).find((c) => c.site === req.siteId && c.code === code);
        if (found && Number(found.percent) === pct) appliedCoupon = { code, percent: pct };
      } else {
        const found = await Coupon.findOne({ site: req.siteId, code });
        if (found && Number(found.percent) === pct) appliedCoupon = { code, percent: pct };
      }
    }

    const isMockEnv = !!req.app?.locals?.mockData;
    const minOrderCents = isMockEnv ? 0 : Math.max(0, Number(process.env.MIN_ORDER_CENTS) || 5000);
    if (subtotalBeforeDiscount < minOrderCents) {
      return res.status(400).json({ error: `Minimum order is $${(minOrderCents/100).toFixed(2)}` });
    }

    // Totals after discount (used for our Order record and tax line)
    const discountCents = appliedCoupon ? Math.round(itemsSubtotal * (Number(appliedCoupon.percent) / 100)) : 0;
    const itemsTotalAfterDiscount = Math.max(0, itemsSubtotal - discountCents);
    const taxCents = Math.round(itemsTotalAfterDiscount * 0.05);
    const totalCents = itemsTotalAfterDiscount + taxCents;

    const orderPayload = {
      site: req.siteId,
      userId: req.user?.userId,
      userEmail: req.user?.email,
      items: items.map((m) => ({
        name: m.name,
        quantity: m.quantity,
        priceCents: m.priceCents,
        size: m.size,
        spiceLevel: m.spiceLevel,
      })),
      totalCents,
      taxCents,
      tipCents: 0,
      fulfillmentType: 'pickup',
      pickup,
      notes: typeof notes === 'string' ? notes.slice(0, 1000) : undefined,
      meta: appliedCoupon ? { coupon: appliedCoupon } : undefined,
      status: 'awaiting_payment',
    };

    // Create order now so webhook can mark it paid later
    let orderId;
    if (mock) {
      if (!Array.isArray(req.app.locals.mockData.orders)) req.app.locals.mockData.orders = [];
      const createdAt = new Date().toISOString();
      const created = { _id: `o-${Date.now()}`, createdAt, ...orderPayload };
      req.app.locals.mockData.orders.unshift(created);
      orderId = created._id;
    } else {
      const created = await Order.create(orderPayload);
      orderId = created._id;
    }

    const origin = req.get('origin') || process.env.FRONTEND_URL || 'http://localhost:5173';
    const slug = String(req.params.slug);

    const lineItems = [
      // Product items at full unit price; discount applied via Stripe "discounts" so it shows in Checkout
      ...items.map((it) => ({
        price_data: {
          currency,
          product_data: { name: it.name },
          unit_amount: Number(it.priceCents) || 0,
        },
        quantity: Number(it.quantity) || 1,
      })),
      // Add tax as separate line
      ...(taxCents > 0 ? [{
        price_data: {
          currency,
          product_data: { name: 'Tax' },
          unit_amount: taxCents,
        },
        quantity: 1,
      }] : []),
    ];

    // Build PI data depending on per-site vs Connect
    const usePerSiteStripe = !!req.site?.stripeSecretKey;
    const piDataPickup = (!usePerSiteStripe && req.site?.stripeAccountId) ? {
      transfer_data: { destination: req.site.stripeAccountId },
      on_behalf_of: req.site.stripeAccountId,
    } : undefined;

    // If coupon applied, create a one-time Stripe coupon so Checkout shows a Discount line
    let discountsParam;
    if (appliedCoupon && typeof appliedCoupon.percent === 'number' && appliedCoupon.percent > 0) {
      try {
        const stripeCoupon = await stripe.coupons.create({ percent_off: Math.round(appliedCoupon.percent), duration: 'once' });
        discountsParam = [{ coupon: stripeCoupon.id }];
      } catch {}
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${origin}/s/${encodeURIComponent(slug)}/orders?status=success&cs={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/s/${encodeURIComponent(slug)}?status=cancelled`,
      customer_email: req.user?.email || undefined,
      payment_intent_data: piDataPickup,
      discounts: discountsParam,
      metadata: {
        orderId: String(orderId),
        siteId: String(req.siteId),
        siteSlug: slug,
        fulfillmentType: 'pickup',
      },
    });

    // Update order with external checkout session id
    if (mock) {
      const list = req.app.locals.mockData.orders || [];
      const idx = list.findIndex((o) => String(o._id) === String(orderId));
      if (idx >= 0) list[idx].externalId = session.id;
    } else {
      await Order.findByIdAndUpdate(orderId, { externalId: session.id });
    }

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Create Stripe Checkout session for a delivery order (Uber created after payment via webhook)
router.post('/:slug/checkout/delivery', requireUser, async (req, res) => {
  try {
    const stripe = getStripeClient(req.site);
    const currency = getCurrency();
    const { dropoff, manifestItems = [], pickupLocationIndex, notes, coupon } = req.body || {};
    const mock = req.app.locals.mockData;

    if (!Array.isArray(manifestItems) || manifestItems.length === 0) {
      return res.status(400).json({ error: 'Items required' });
    }

    let site;
    if (mock) {
      site = (req.app.locals.mockData.sites || []).find((s) => s._id === req.siteId);
    } else {
      site = await Site.findById(req.siteId);
    }
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const locs = (Array.isArray(site.locations) && site.locations.length)
      ? site.locations
      : (site.pickup ? [site.pickup] : []);
    if (!locs.length) return res.status(400).json({ error: 'No pickup location configured' });
    const chosenIdx = (typeof pickupLocationIndex === 'number' && locs[pickupLocationIndex]) ? pickupLocationIndex : 0;
    const pickup = locs[chosenIdx];

    // Items subtotal and coupon validation (we'll apply discount in Stripe Checkout via discounts)
    const itemsSubtotal = manifestItems.reduce((sum, it) => sum + (Number(it.priceCents) || 0) * (Number(it.quantity) || 1), 0);
    const COUPON_MIN_SUBTOTAL_CENTS = Math.max(0, Number(process.env.COUPON_MIN_SUBTOTAL_CENTS) || 5000);
    const subtotalBeforeDiscount = itemsSubtotal;
    let appliedCoupon = null;
    if (coupon && coupon.code && typeof coupon.percent === 'number' && subtotalBeforeDiscount >= COUPON_MIN_SUBTOTAL_CENTS) {
      const code = String(coupon.code).trim().toUpperCase();
      const pct = Math.max(0, Math.min(100, Number(coupon.percent)||0));
      if (mock) {
        const found = (req.app.locals.mockData.coupons || []).find((c) => c.site === req.siteId && c.code === code);
        if (found && Number(found.percent) === pct) { appliedCoupon = { code, percent: pct }; }
      } else {
        const found = await Coupon.findOne({ site: req.siteId, code });
        if (found && Number(found.percent) === pct) { appliedCoupon = { code, percent: pct }; }
      }
    }

    const isMockEnv = !!req.app?.locals?.mockData;
    const minOrderCents = isMockEnv ? 0 : Math.max(0, Number(process.env.MIN_ORDER_CENTS) || 5000);
    if (subtotalBeforeDiscount < minOrderCents) return res.status(400).json({ error: `Minimum total amount should be $${(minOrderCents/100).toFixed(2)} required for delivery` });

    // Compute delivery fee based on distance and enforce max km if configured
    let distanceKm = null;
    try { distanceKm = await distanceBetweenAddressesKm(pickup.address, dropoff?.address); } catch {}
    const maxKm = typeof site?.maxDeliveryDistanceKm === 'number' && site.maxDeliveryDistanceKm > 0 ? site.maxDeliveryDistanceKm : null;
    if (maxKm != null && typeof distanceKm === 'number' && distanceKm > maxKm) {
      return res.status(400).json({ error: `Delivery is only available within ${maxKm} km of the restaurant.` });
    }
    const fullDeliveryFeeCents = calculateDistanceFeeCents(distanceKm);
    const split = !!site.splitDeliveryFee;
    const customerDeliveryFeeCents = split ? Math.round(fullDeliveryFeeCents / 2) : fullDeliveryFeeCents;
    const restaurantDeliveryFeeCents = split ? (fullDeliveryFeeCents - customerDeliveryFeeCents) : 0;

    const discountCents = appliedCoupon ? Math.round(itemsSubtotal * (Number(appliedCoupon.percent) / 100)) : 0;
    const itemsTotalAfterDiscount = Math.max(0, itemsSubtotal - discountCents);
    const taxCents = Math.round(itemsTotalAfterDiscount * 0.05);
    const totalCents = itemsTotalAfterDiscount + taxCents + customerDeliveryFeeCents;

    // Create order (awaiting_payment). Uber delivery will be created on webhook after payment
    const orderPayload = {
      site: req.siteId,
      userId: req.user?.userId,
      userEmail: req.user?.email,
      items: manifestItems.map((m) => ({ name: m.name, quantity: m.quantity, priceCents: m.priceCents || m.price || 0, size: m.size, spiceLevel: m.spiceLevel })),
      totalCents,
      taxCents,
      deliveryFeeCents: customerDeliveryFeeCents,
      deliveryFeeRestaurantCents: restaurantDeliveryFeeCents,
      fulfillmentType: 'delivery',
      dropoff,
      pickup: { location: pickup },
      notes: typeof notes === 'string' ? notes.slice(0, 1000) : undefined,
      meta: { distanceKm },
      status: 'awaiting_payment',
    };
    let orderId;
    if (mock) {
      if (!Array.isArray(req.app.locals.mockData.orders)) req.app.locals.mockData.orders = [];
      const createdAt = new Date().toISOString();
      const created = { _id: `o-${Date.now()}`, createdAt, ...orderPayload };
      req.app.locals.mockData.orders.unshift(created);
      orderId = created._id;
    } else {
      const created = await Order.create(orderPayload);
      orderId = created._id;
    }

    const origin = req.get('origin') || process.env.FRONTEND_URL || 'http://localhost:5173';
    const slug = String(req.params.slug);

    const lineItems = [
      ...manifestItems.map((it) => ({
        price_data: {
          currency,
          product_data: { name: it.name },
          unit_amount: Number(it.priceCents || it.price) || 0,
        },
        quantity: Number(it.quantity) || 1,
      })),
      ...(taxCents > 0 ? [{
        price_data: { currency, product_data: { name: 'Tax' }, unit_amount: taxCents }, quantity: 1,
      }] : []),
      ...(customerDeliveryFeeCents > 0 ? [{
        price_data: { currency, product_data: { name: 'Delivery fee' }, unit_amount: customerDeliveryFeeCents }, quantity: 1,
      }] : []),
    ];

    const usePerSiteStripeDel = !!site?.stripeSecretKey;
    const piDataDelivery = (!usePerSiteStripeDel && site?.stripeAccountId) ? {
      transfer_data: { destination: site.stripeAccountId },
      application_fee_amount: fullDeliveryFeeCents,
      on_behalf_of: site.stripeAccountId,
    } : undefined;

    // If coupon applied, create one-time Stripe coupon so Checkout shows a Discount line
    let discountsParam;
    if (appliedCoupon && typeof appliedCoupon.percent === 'number' && appliedCoupon.percent > 0) {
      try {
        const stripeCoupon = await stripe.coupons.create({ percent_off: Math.round(appliedCoupon.percent), duration: 'once' });
        discountsParam = [{ coupon: stripeCoupon.id }];
      } catch {}
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${origin}/s/${encodeURIComponent(slug)}/orders?status=success&cs={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/s/${encodeURIComponent(slug)}?status=cancelled`,
      customer_email: req.user?.email || undefined,
      payment_intent_data: piDataDelivery,
      discounts: discountsParam,
      metadata: {
        orderId: String(orderId),
        siteId: String(req.siteId),
        siteSlug: slug,
        fulfillmentType: 'delivery',
      },
    });

    if (mock) {
      const list = req.app.locals.mockData.orders || [];
      const idx = list.findIndex((o) => String(o._id) === String(orderId));
      if (idx >= 0) list[idx].externalId = session.id;
    } else {
      await Order.findByIdAndUpdate(orderId, { externalId: session.id });
    }

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;

