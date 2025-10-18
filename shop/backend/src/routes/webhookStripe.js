import { Router } from 'express';
import Stripe from 'stripe';
import Order from '../models/Order.js';
import Site from '../models/Site.js';
import { createDelivery as uberCreateDelivery } from '../services/uberDirect.js';
import { createDelivery as ddCreateDelivery } from '../services/doordashDrive.js';
import { sendOrderEmail } from '../utils/mailer.js';
import fetch from 'node-fetch';

const router = Router();

// Notify Blueboxx backend by default after payment events
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
  } catch {
    // Non-blocking: ignore notify errors
  }
}

function getStripeClient(site) {
  const siteSecret = site?.stripeSecretKey;
  const secret = siteSecret || process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error('Missing STRIPE_SECRET_KEY');
  return new Stripe(secret);
}

// Health endpoint for a specific site (optional)
router.get('/:siteIdOrSlug', async (req, res) => {
  try {
    const { siteIdOrSlug } = req.params;
    let site = null;
    const mock = req.app?.locals?.mockData;
    if (mock) {
      site = (mock.sites || []).find((s) => s._id === siteIdOrSlug || s.slug === siteIdOrSlug);
    } else {
      try { site = await Site.findById(siteIdOrSlug); } catch {}
      if (!site) site = await Site.findOne({ slug: siteIdOrSlug });
    }
    if (!site) return res.status(404).json({ ok: false, error: 'Site not found' });
    return res.json({ ok: true, siteId: String(site._id), slug: site.slug, hasSecret: !!site.stripeWebhookSecret });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// IMPORTANT: This route must be mounted with express.raw({ type: 'application/json' })
router.post('/:siteIdOrSlug', async (req, res) => {
  const { siteIdOrSlug } = req.params;
  let site = null;
  const mock = req.app?.locals?.mockData;
  if (mock) {
    site = (mock.sites || []).find((s) => s._id === siteIdOrSlug || s.slug === siteIdOrSlug) || null;
  } else {
    try { site = await Site.findById(siteIdOrSlug); } catch {}
    if (!site) site = await Site.findOne({ slug: siteIdOrSlug });
  }

  const stripe = getStripeClient(site);
  const configuredSecret = site?.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET;
  let event = null;

  if (configuredSecret) {
    const signature = req.headers['stripe-signature'];
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, configuredSecret);
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    try {
      const json = typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body || {});
      event = JSON.parse(json);
    } catch (err) {
      return res.status(400).send(`Invalid webhook payload: ${err.message}`);
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const orderId = session.metadata?.orderId;
        if (orderId) {
          if (req.app.locals.mockData) {
            const list = req.app.locals.mockData.orders || [];
            const idx = list.findIndex((o) => String(o._id) === String(orderId));
            if (idx >= 0) {
              // Mark paid
              list[idx].status = 'paid';
              try {
                // If delivery order without provider delivery yet, create it now (real API if creds exist)
                if (list[idx].fulfillmentType === 'delivery' && !list[idx].uberDeliveryId) {
                  const site = (req.app.locals.mockData.sites || []).find((s) => s._id === String(list[idx].site));
                  if (site && list[idx]?.dropoff && list[idx]?.pickup?.location) {
                    const provider = site.deliveryProvider || 'uber';
                    let delivery = null;
                    if (provider === 'doordash' && site.doordashStoreId) {
                      delivery = await ddCreateDelivery({
                        storeId: site.doordashStoreId,
                        pickup: list[idx].pickup.location,
                        dropoff: list[idx].dropoff,
                        manifestItems: (list[idx].items || []).map((m) => ({ name: m.name, quantity: m.quantity, size: m.size, price: m.priceCents, spiceLevel: m.spiceLevel })),
                        tip: 0,
                        externalId: String(list[idx]._id),
                      });
                    } else if (site.uberCustomerId) {
                      delivery = await uberCreateDelivery({
                        customerId: site.uberCustomerId,
                        pickup: list[idx].pickup.location,
                        dropoff: list[idx].dropoff,
                        manifestItems: (list[idx].items || []).map((m) => ({ name: m.name, quantity: m.quantity, size: m.size, price: m.priceCents, spiceLevel: m.spiceLevel })),
                        tip: 0,
                        externalId: String(list[idx]._id),
                        creds: { clientId: site?.uberClientId, clientSecret: site?.uberClientSecret, env: site?.uberEnv, scopes: site?.uberTokenScopes }
                      });
                    }
                    if (delivery) {
                      const trackingUrl = delivery?.tracking_url || delivery?.trackingUrl || delivery?.share_url || '';
                      const status = delivery?.status || delivery?.state || delivery?.current_status || '';
                      list[idx].uberDeliveryId = delivery?.id || delivery?.delivery_id;
                      list[idx].uberTrackingUrl = trackingUrl;
                      list[idx].uberStatus = status;
                    }
                  }
                }
                const site = (req.app.locals.mockData.sites || []).find((s) => s._id === String(list[idx].site));
                const siteName = site?.name || '';
                await sendOrderEmail({ to: list[idx].userEmail, siteName, orderId, items: list[idx].items, totalCents: list[idx].totalCents, deliveryFeeCents: list[idx].deliveryFeeCents, fulfillmentType: list[idx].fulfillmentType, trackingUrl: list[idx].uberTrackingUrl });
                await sendOrderNotify(list[idx], siteName);
              } catch {}
            }
          } else {
            const order = await Order.findByIdAndUpdate(orderId, { status: 'paid' }, { new: true });
            try {
              // If delivery order without provider delivery yet, create it now
              if (order && order.fulfillmentType === 'delivery' && !order.uberDeliveryId) {
                const site = await Site.findById(order.site);
                if (order?.dropoff && order?.pickup?.location && site) {
                  const provider = site.deliveryProvider || 'uber';
                  let delivery = null;
                  if (provider === 'doordash' && site.doordashStoreId) {
                    delivery = await ddCreateDelivery({
                      storeId: site.doordashStoreId,
                      pickup: order.pickup.location,
                      dropoff: order.dropoff,
                      manifestItems: (order.items || []).map((m) => ({ name: m.name, quantity: m.quantity, size: m.size, price: m.priceCents, spiceLevel: m.spiceLevel })),
                      tip: 0,
                      externalId: String(order._id),
                    });
                  } else if (site.uberCustomerId) {
                    delivery = await uberCreateDelivery({
                      customerId: site.uberCustomerId,
                      pickup: order.pickup.location,
                      dropoff: order.dropoff,
                      manifestItems: (order.items || []).map((m) => ({ name: m.name, quantity: m.quantity, size: m.size, price: m.priceCents, spiceLevel: m.spiceLevel })),
                      tip: 0,
                      externalId: String(order._id),
                      creds: { clientId: site?.uberClientId, clientSecret: site?.uberClientSecret, env: site?.uberEnv, scopes: site?.uberTokenScopes }
                    });
                  }
                  if (delivery) {
                    const trackingUrl = delivery?.tracking_url || delivery?.trackingUrl || delivery?.share_url || '';
                    const status = delivery?.status || delivery?.state || delivery?.current_status || '';
                    await Order.findByIdAndUpdate(order._id, { uberDeliveryId: delivery?.id || delivery?.delivery_id, uberTrackingUrl: trackingUrl, uberStatus: status });
                  }
                }
              }
            } catch (e) {
              // swallow Uber errors; order remains paid
            }
            try {
              const site = await Site.findById(order.site);
              await sendOrderEmail({ to: order.userEmail, siteName: site?.name || '', orderId: order._id, items: order.items, totalCents: order.totalCents, deliveryFeeCents: order.deliveryFeeCents, fulfillmentType: order.fulfillmentType, trackingUrl: order.uberTrackingUrl });
              await sendOrderNotify(order, site?.name || '');
            } catch {}
          }
        }
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

