import { Router } from 'express';
import Stripe from 'stripe';
import Order from '../models/Order.js';

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
            }
          } else {
            await Order.findByIdAndUpdate(orderId, { status: 'paid' });
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

