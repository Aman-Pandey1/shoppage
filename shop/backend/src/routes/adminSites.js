import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import Site from '../models/Site.js';
import { saveMockData } from '../utils/mockStore.js';
import Order from '../models/Order.js';
import mongoose from 'mongoose';

const router = Router();

router.get('/', requireAdmin, async (_req, res) => {
	try {
		const mock = _req.app.locals.mockData;
		if (mock) {
			return res.json([...mock.sites]);
		}
		const sites = await Site.find({}).sort({ createdAt: -1 });
		res.json(sites);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

router.post('/', requireAdmin, async (req, res) => {
	try {
		const { name, slug, domains, uberCustomerId, pickup, brandColor, locations, cities, hours, deliveryFeeCents } = req.body || {};
		if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });
		const mock = req.app.locals.mockData;
		if (mock) {
			const created = { _id: `site-${Date.now()}`, name, slug, domains: domains || [], uberCustomerId, pickup, locations: Array.isArray(locations) ? locations : [], cities: Array.isArray(cities) ? cities : [], hours: hours || undefined, deliveryFeeCents: Number(deliveryFeeCents) || 0, brandColor: brandColor || '#0ea5e9', isActive: true };
			mock.sites.unshift(created);
			try { saveMockData(req.app.locals.mockData); } catch {}
			return res.status(201).json(created);
		}
		const site = await Site.create({ name, slug, domains: domains || [], uberCustomerId, pickup, locations: Array.isArray(locations) ? locations : [], cities: Array.isArray(cities) ? cities : [], hours, deliveryFeeCents: Number(deliveryFeeCents) || 0, brandColor: brandColor || '#0ea5e9', isActive: true });
		res.status(201).json(site);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

router.patch('/:siteId', requireAdmin, async (req, res) => {
	try {
		const { siteId } = req.params;
		const { name, slug, domains, isActive, uberCustomerId, pickup, brandColor, locations, cities, hours, deliveryFeeCents } = req.body || {};
		const mock = req.app.locals.mockData;
		if (mock) {
			const idx = mock.sites.findIndex((s) => s._id === siteId);
			if (idx === -1) return res.status(404).json({ error: 'Not found' });
			const updated = { ...mock.sites[idx], ...(name !== undefined ? { name } : {}), ...(slug !== undefined ? { slug } : {}), ...(domains !== undefined ? { domains } : {}), ...(isActive !== undefined ? { isActive } : {}), ...(uberCustomerId !== undefined ? { uberCustomerId } : {}), ...(pickup !== undefined ? { pickup } : {}), ...(brandColor !== undefined ? { brandColor } : {}), ...(locations !== undefined ? { locations } : {}), ...(cities !== undefined ? { cities } : {}), ...(hours !== undefined ? { hours } : {}), ...(deliveryFeeCents !== undefined ? { deliveryFeeCents: Number(deliveryFeeCents) || 0 } : {}) };
			mock.sites[idx] = updated;
			try { saveMockData(req.app.locals.mockData); } catch {}
			return res.json(updated);
		}
		const site = await Site.findByIdAndUpdate(siteId, { name, slug, domains, isActive, uberCustomerId, pickup, brandColor, locations, cities, hours, deliveryFeeCents: deliveryFeeCents !== undefined ? Number(deliveryFeeCents) || 0 : undefined }, { new: true });
		if (!site) return res.status(404).json({ error: 'Not found' });
		res.json(site);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

router.delete('/:siteId', requireAdmin, async (req, res) => {
	try {
		const { siteId } = req.params;
		const mock = req.app.locals.mockData;
		if (mock) {
			const before = mock.sites.length;
			mock.sites = mock.sites.filter((s) => s._id !== siteId);
			if (mock.sites.length === before) return res.status(404).json({ error: 'Not found' });
			mock.categories = mock.categories.filter((c) => c.site !== siteId);
			mock.products = mock.products.filter((p) => p.site !== siteId);
			try { saveMockData(req.app.locals.mockData); } catch {}
			return res.status(204).end();
		}
		await Site.findByIdAndDelete(siteId);
		res.status(204).end();
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

export default router;

// Billing (weekly/monthly totals) for a site
export const adminBillingRouter = Router();

adminBillingRouter.get('/sites/:siteId/billing', requireAdmin, async (req, res) => {
  try {
    const { siteId } = req.params;
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday as start
    startOfWeek.setHours(0,0,0,0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const mock = req.app.locals.mockData;
    if (mock) {
      const orders = (mock.orders || []).filter((o) => o.site === siteId);
      const isToday = (o) => new Date(o.createdAt || 0) >= startOfDay;
      const isWeek = (o) => new Date(o.createdAt || 0) >= startOfWeek;
      const isMonth = (o) => new Date(o.createdAt || 0) >= startOfMonth;
      const sum = (list, field) => list.reduce((s, o) => s + (Number(o[field]) || 0), 0);
      const todayOrders = orders.filter(isToday);
      const weekOrders = orders.filter(isWeek);
      const monthOrders = orders.filter(isMonth);

      const todayTotalCents = sum(todayOrders, 'totalCents');
      const weekTotalCents = sum(weekOrders, 'totalCents');
      const monthTotalCents = sum(monthOrders, 'totalCents');
      const todayDeliveryFeeCents = sum(todayOrders, 'deliveryFeeCents');
      const weekDeliveryFeeCents = sum(weekOrders, 'deliveryFeeCents');
      const monthDeliveryFeeCents = sum(monthOrders, 'deliveryFeeCents');

      // Selling totals exclude delivery fees (items + tip only)
      const todaySellingCents = todayTotalCents - todayDeliveryFeeCents;
      const weekSellingCents = weekTotalCents - weekDeliveryFeeCents;
      const monthSellingCents = monthTotalCents - monthDeliveryFeeCents;

      return res.json({
        todayTotalCents: todaySellingCents,
        todayDeliveryFeeCents,
        weekTotalCents: weekSellingCents,
        monthTotalCents: monthSellingCents,
        todaySellingCents,
        weekSellingCents,
        monthSellingCents,
        weekDeliveryFeeCents,
        monthDeliveryFeeCents,
      });
    }

    const [todayAgg] = await Order.aggregate([
      { $match: { site: new mongoose.Types.ObjectId(siteId), createdAt: { $gte: startOfDay } } },
      { $group: { _id: null, total: { $sum: '$totalCents' }, deliveryFees: { $sum: '$deliveryFeeCents' } } },
    ]);
    const [weekAgg] = await Order.aggregate([
      { $match: { site: new mongoose.Types.ObjectId(siteId), createdAt: { $gte: startOfWeek } } },
      { $group: { _id: null, total: { $sum: '$totalCents' }, deliveryFees: { $sum: '$deliveryFeeCents' } } },
    ]);
    const [monthAgg] = await Order.aggregate([
      { $match: { site: new mongoose.Types.ObjectId(siteId), createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$totalCents' }, deliveryFees: { $sum: '$deliveryFeeCents' } } },
    ]);

    const todaySellingCents = (todayAgg?.total || 0) - (todayAgg?.deliveryFees || 0);
    const weekSellingCents = (weekAgg?.total || 0) - (weekAgg?.deliveryFees || 0);
    const monthSellingCents = (monthAgg?.total || 0) - (monthAgg?.deliveryFees || 0);

    res.json({
      todayTotalCents: todaySellingCents,
      todayDeliveryFeeCents: todayAgg?.deliveryFees || 0,
      weekTotalCents: weekSellingCents,
      monthTotalCents: monthSellingCents,
      todaySellingCents,
      weekSellingCents,
      monthSellingCents,
      weekDeliveryFeeCents: weekAgg?.deliveryFees || 0,
      monthDeliveryFeeCents: monthAgg?.deliveryFees || 0,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

