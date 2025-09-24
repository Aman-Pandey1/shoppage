import { Router } from 'express';
import { tenantBySlug } from '../middleware/tenant.js';
import { requireUser } from '../middleware/auth.js';
import Order from '../models/Order.js';
import Site from '../models/Site.js';
import { getDelivery } from '../services/uberDirect.js';

const router = Router();

router.use('/:slug', tenantBySlug);

router.get('/:slug/orders/mine', requireUser, async (req, res) => {
  try {
    const mock = req.app.locals.mockData;
    if (mock) {
      const list = (mock.orders || []).filter((o) => o.site === req.siteId && o.userEmail === req.user?.email);
      return res.json(list);
    }
    const list = await Order.find({ site: req.siteId, userId: req.user?.userId }).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get tracking details for a specific order (user's own order only)
router.get('/:slug/orders/:orderId/tracking', requireUser, async (req, res) => {
  try {
    const { orderId } = req.params;
    const mock = req.app.locals.mockData;
    let order;
    if (mock) {
      order = (mock.orders || []).find((o) => String(o._id) === String(orderId) && o.site === req.siteId);
      if (!order) return res.status(404).json({ error: 'Order not found' });
      if (String(order.userEmail || '') !== String(req.user?.email || '')) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      return res.json({
        uberDeliveryId: order.uberDeliveryId,
        uberTrackingUrl: order.uberTrackingUrl,
        uberStatus: order.uberStatus || 'unknown',
      });
    }
    order = await Order.findOne({ _id: orderId, site: req.siteId, userId: req.user?.userId });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    // If we have Uber delivery ID and site has uberCustomerId, fetch live status
    const site = await Site.findById(req.siteId);
    let live;
    if (site?.uberCustomerId && order?.uberDeliveryId) {
      try {
        live = await getDelivery({ customerId: site.uberCustomerId, deliveryId: order.uberDeliveryId });
      } catch (e) {
        // ignore live fetch errors; fall back to stored fields
      }
    }
    const trackingUrl = live?.tracking_url || live?.trackingUrl || live?.share_url || order.uberTrackingUrl || '';
    const status = live?.status || live?.state || live?.current_status || order.uberStatus || 'unknown';
    res.json({
      uberDeliveryId: order.uberDeliveryId,
      uberTrackingUrl: trackingUrl,
      uberStatus: status,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create a pickup order (no Uber delivery). Requires user or admin auth.
router.post('/:slug/orders/pickup', requireUser, async (req, res) => {
  try {
    const { items, tipCents, pickup, notes } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Items required' });
    const itemsTotal = items.reduce((s, it) => s + (Number(it.priceCents)||0) * (Number(it.quantity)||1), 0);
    if (itemsTotal < 5000) return res.status(400).json({ error: 'Minimum order is $50.00' });
    const taxCents = Math.round(itemsTotal * 0.05);
    const tip = Number(tipCents) || 0;
    const totalCents = itemsTotal + taxCents + tip;
    const orderPayload = {
      site: req.siteId,
      userId: req.user?.userId,
      userEmail: req.user?.email,
      items: items.map((m) => ({ name: m.name, quantity: m.quantity, priceCents: m.priceCents, size: m.size })),
      totalCents,
      taxCents,
      tipCents: tip,
      fulfillmentType: 'pickup',
      pickup,
      notes: typeof notes === 'string' ? notes.slice(0, 1000) : undefined,
    };
    if (req.app.locals.mockData) {
      if (!Array.isArray(req.app.locals.mockData.orders)) req.app.locals.mockData.orders = [];
      const createdAt = new Date().toISOString();
      const created = { _id: `o-${Date.now()}`, createdAt, ...orderPayload };
      req.app.locals.mockData.orders.unshift(created);
      return res.status(201).json(created);
    }
    const created = await Order.create(orderPayload);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

