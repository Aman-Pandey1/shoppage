import { Router } from 'express';
import Stripe from 'stripe';
import Order from '../models/Order.js';
import Site from '../models/Site.js';
import { createDelivery as uberCreateDelivery } from '../services/uberDirect.js';
import { createDelivery as ddCreateDelivery } from '../services/doordashDrive.js';
import { sendOrderEmail } from '../utils/mailer.js';

const router = Router();

function getStripeClient() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error('Missing STRIPE_SECRET_KEY');
  return new Stripe(secret);
}

// IMPORTANT: This route must be mounted with express.raw({ type: 'application/json' })
router.post('/', async (req, res) => {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event = null;

  if (webhookSecret) {
    const signature = req.headers['stripe-signature'];
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
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
              list[idx].status = 'paid';
              try {
                const site = (req.app.locals.mockData.sites || []).find((s) => s._id === String(list[idx].site));
                const siteName = site?.name || '';
                await sendOrderEmail({ to: list[idx].userEmail, siteName, orderId, items: list[idx].items, totalCents: list[idx].totalCents, deliveryFeeCents: list[idx].deliveryFeeCents, fulfillmentType: list[idx].fulfillmentType, trackingUrl: list[idx].uberTrackingUrl });
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

