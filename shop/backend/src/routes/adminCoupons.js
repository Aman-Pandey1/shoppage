import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import Coupon from '../models/Coupon.js';

const router = Router({ mergeParams: true });

// List coupons for a site
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { siteId } = req.params;
    const mock = req.app.locals.mockData;
    if (mock) {
      const list = (mock.coupons || []).filter((c) => c.site === siteId);
      return res.json(list);
    }
    const list = await Coupon.find({ site: siteId }).sort({ createdAt: -1 });
    return res.json(list);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Create coupon
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { siteId } = req.params;
    const { code, percent } = req.body || {};
    if (!code || typeof percent !== 'number') return res.status(400).json({ error: 'code and percent required' });
    const normalized = String(code).trim().toUpperCase();
    if (req.app.locals.mockData) {
      const list = req.app.locals.mockData.coupons || (req.app.locals.mockData.coupons = []);
      if (list.find((c) => c.site === siteId && c.code === normalized)) return res.status(400).json({ error: 'Coupon exists' });
      const created = { _id: `cp-${Date.now()}`, site: siteId, code: normalized, percent: Math.max(0, Math.min(100, percent)) };
      list.unshift(created);
      return res.status(201).json(created);
    }
    const created = await Coupon.create({ site: siteId, code: normalized, percent: Math.max(0, Math.min(100, percent)) });
    return res.status(201).json(created);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Delete coupon
router.delete('/:couponId', requireAdmin, async (req, res) => {
  try {
    const { siteId, couponId } = req.params;
    if (req.app.locals.mockData) {
      const list = req.app.locals.mockData.coupons || [];
      const before = list.length;
      req.app.locals.mockData.coupons = list.filter((c) => !(String(c._id) === String(couponId) && String(c.site) === String(siteId)));
      return res.json({ deleted: before - req.app.locals.mockData.coupons.length });
    }
    const resDel = await Coupon.deleteOne({ _id: couponId, site: siteId });
    return res.json({ deleted: resDel.deletedCount || 0 });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;

