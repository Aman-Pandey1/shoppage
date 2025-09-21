import { Router } from 'express';
import { tenantBySlug } from '../middleware/tenant.js';
import { requireUser } from '../middleware/auth.js';
import Order from '../models/Order.js';

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

// Create a pickup order (no Uber delivery). Requires user or admin auth.
router.post('/:slug/orders/pickup', requireUser, async (req, res) => {
  try {
    const { items, totalCents, tipCents, pickup } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Items required' });
    const orderPayload = {
      site: req.siteId,
      userId: req.user?.userId,
      userEmail: req.user?.email,
      items: items.map((m) => ({ name: m.name, quantity: m.quantity, priceCents: m.priceCents, size: m.size })),
      totalCents: Number(totalCents) || items.reduce((s, it) => s + (Number(it.priceCents)||0) * (Number(it.quantity)||1), 0),
      tipCents: Number(tipCents) || 0,
      fulfillmentType: 'pickup',
      pickup,
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

