import { Router } from 'express';
import Stripe from 'stripe';
import { tenantBySlug } from '../middleware/tenant.js';
import { requireUser } from '../middleware/auth.js';
import Order from '../models/Order.js';
import Coupon from '../models/Coupon.js';
import Site from '../models/Site.js';
import { calculateDistanceFeeCents, distanceBetweenAddressesKm } from '../services/geo.js';

const router = Router();

// Resolve by :slug for all endpoints here
router.use('/:slug', tenantBySlug);

function getStripeClient() {
  const secret = process.env.STRIPE_SECRET_KEY;
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
    const stripe = getStripeClient();
    const currency = getCurrency();
    const { items = [], pickup, notes, coupon } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items required' });
    }

    // Compute items total in cents
    let itemsTotal = items.reduce((sum, it) => sum + (Number(it.priceCents) || 0) * (Number(it.quantity) || 1), 0);

    // Apply coupon if valid
    let appliedCoupon = null;
    const code = coupon?.code ? String(coupon.code).trim().toUpperCase() : null;
    const pct = typeof coupon?.percent === 'number' ? Math.max(0, Math.min(100, Number(coupon.percent) || 0)) : null;
    const mock = req.app.locals.mockData;
    if (code && typeof pct === 'number') {
      if (mock) {
        const found = (mock.coupons || []).find((c) => c.site === req.siteId && c.code === code);
        if (found && Number(found.percent) === pct) {
          itemsTotal = Math.max(0, itemsTotal - Math.round(itemsTotal * (pct / 100)));
          appliedCoupon = { code, percent: pct };
        }
      } else {
        const found = await Coupon.findOne({ site: req.siteId, code });
        if (found && Number(found.percent) === pct) {
          itemsTotal = Math.max(0, itemsTotal - Math.round(itemsTotal * (pct / 100)));
          appliedCoupon = { code, percent: pct };
        }
      }
    }

    const isMockEnv = !!req.app?.locals?.mockData;
    const minOrderCents = isMockEnv ? 0 : Math.max(0, Number(process.env.MIN_ORDER_CENTS) || 5000);
    if (itemsTotal < minOrderCents) {
      return res.status(400).json({ error: `Minimum order is $${(minOrderCents/100).toFixed(2)}` });
    }

    const taxCents = Math.round(itemsTotal * 0.05);
    const totalCents = itemsTotal + taxCents;

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
      // Each product item
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

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${origin}/s/${encodeURIComponent(slug)}/orders?status=success&cs={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/s/${encodeURIComponent(slug)}?status=cancelled`,
      customer_email: req.user?.email || undefined,
      payment_intent_data: req.site?.stripeAccountId ? {
        transfer_data: { destination: req.site.stripeAccountId },
        on_behalf_of: req.site.stripeAccountId,
      } : undefined,
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
    const stripe = getStripeClient();
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

    // Items total and coupon
    let itemsTotal = manifestItems.reduce((sum, it) => sum + (Number(it.priceCents) || 0) * (Number(it.quantity) || 1), 0);
    let appliedCoupon = null;
    if (coupon && coupon.code && typeof coupon.percent === 'number') {
      const code = String(coupon.code).trim().toUpperCase();
      const pct = Math.max(0, Math.min(100, Number(coupon.percent)||0));
      if (mock) {
        const found = (req.app.locals.mockData.coupons || []).find((c) => c.site === req.siteId && c.code === code);
        if (found && Number(found.percent) === pct) {
          itemsTotal = Math.max(0, itemsTotal - Math.round(itemsTotal * (pct / 100)));
          appliedCoupon = { code, percent: pct };
        }
      } else {
        const found = await Coupon.findOne({ site: req.siteId, code });
        if (found && Number(found.percent) === pct) {
          itemsTotal = Math.max(0, itemsTotal - Math.round(itemsTotal * (pct / 100)));
          appliedCoupon = { code, percent: pct };
        }
      }
    }

    const isMockEnv = !!req.app?.locals?.mockData;
    const minOrderCents = isMockEnv ? 0 : Math.max(0, Number(process.env.MIN_ORDER_CENTS) || 5000);
    if (itemsTotal < minOrderCents) return res.status(400).json({ error: `Minimum order is $${(minOrderCents/100).toFixed(2)}` });

    // Compute delivery fee based on distance
    let distanceKm = null;
    try { distanceKm = await distanceBetweenAddressesKm(pickup.address, dropoff?.address); } catch {}
    const fullDeliveryFeeCents = calculateDistanceFeeCents(distanceKm);
    const split = !!site.splitDeliveryFee;
    const customerDeliveryFeeCents = split ? Math.round(fullDeliveryFeeCents / 2) : fullDeliveryFeeCents;
    const restaurantDeliveryFeeCents = split ? (fullDeliveryFeeCents - customerDeliveryFeeCents) : 0;

    const taxCents = Math.round(itemsTotal * 0.05);
    const totalCents = itemsTotal + taxCents + customerDeliveryFeeCents;

    // Create order (awaiting_payment). Uber delivery will be created on webhook after payment
    const orderPayload = {
      site: req.siteId,
      userId: req.user?.userId,
      userEmail: req.user?.email,
      items: manifestItems.map((m) => ({ name: m.name, quantity: m.quantity, priceCents: m.priceCents || m.price || 0, size: m.size, spiceLevel: m.spiceLevel })),
      totalCents,
      taxCents,
      deliveryFeeCents: customerDeliveryFeeCents,
      deliveryFeeRestaurantCents,
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

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${origin}/s/${encodeURIComponent(slug)}/orders?status=success&cs={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/s/${encodeURIComponent(slug)}?status=cancelled`,
      customer_email: req.user?.email || undefined,
      payment_intent_data: site?.stripeAccountId ? {
        transfer_data: { destination: site.stripeAccountId },
        application_fee_amount: fullDeliveryFeeCents,
        on_behalf_of: site.stripeAccountId,
      } : undefined,
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

