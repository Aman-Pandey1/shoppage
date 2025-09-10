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

export default router;

