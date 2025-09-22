import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import Order from '../models/Order.js';

const router = Router({ mergeParams: true });

// List orders for a site with optional from/to date filters (inclusive)
router.get('/', requireAdmin, async (req, res) => {
	try {
		const { siteId } = req.params;
		const { from, to } = req.query;
		const mock = req.app.locals.mockData;

		const fromDate = from ? new Date(from) : null;
		const toDate = to ? new Date(to) : null;
		if (toDate) {
			// include the entire 'to' day if only date provided
			if (String(to).length <= 10) toDate.setHours(23, 59, 59, 999);
		}

		if (mock) {
			let list = Array.isArray(mock.orders) ? mock.orders : [];
			list = list.filter((o) => o.site === siteId);
			if (fromDate) list = list.filter((o) => new Date(o.createdAt) >= fromDate);
			if (toDate) list = list.filter((o) => new Date(o.createdAt) <= toDate);
			list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
			return res.json(list);
		}

		const filter = { site: siteId };
		if (fromDate || toDate) filter.createdAt = {};
		if (fromDate) filter.createdAt.$gte = fromDate;
		if (toDate) filter.createdAt.$lte = toDate;
		const orders = await Order.find(filter).sort({ createdAt: -1 });
		res.json(orders);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

export default router;

