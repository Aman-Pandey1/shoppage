import { Router } from 'express';
import Stripe from 'stripe';
import { tenantBySlug } from '../middleware/tenant.js';
import { requireUser } from '../middleware/auth.js';
import Order from '../models/Order.js';
import Coupon from '../models/Coupon.js';

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

    if (itemsTotal < 5000) {
      return res.status(400).json({ error: 'Minimum order is $50.00' });
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

export default router;

