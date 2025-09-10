import { Router } from 'express';
import { tenantBySlug } from '../middleware/tenant.js';
import { requireUser } from '../middleware/auth.js';
import Order from '../models/Order.js';
import Site from '../models/Site.js';
import { requestQuote, createDelivery } from '../services/uberDirect.js';

const router = Router();

router.use('/:slug', tenantBySlug);

router.post('/:slug/quote', async (req, res) => {
	try {
		const mock = req.app.locals.mockData;
		let site;
		if (mock) {
			site = mock.sites.find((s) => s._id === req.siteId);
		} else {
			site = await Site.findById(req.siteId);
		}
		if (!site?.uberCustomerId || !site?.pickup?.address) return res.status(400).json({ error: 'Site not configured for Uber Direct' });
		const { dropoff } = req.body || {};
		if (!dropoff?.address?.streetAddress) return res.status(400).json({ error: 'Invalid dropoff address' });
		const quote = await requestQuote({
			customerId: site.uberCustomerId,
			pickup: site.pickup,
			dropoff,
		});
		res.json(quote);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

router.post('/:slug/create', requireUser, async (req, res) => {
	try {
		const mock = req.app.locals.mockData;
		let site;
		if (mock) {
			site = mock.sites.find((s) => s._id === req.siteId);
		} else {
			site = await Site.findById(req.siteId);
		}
		if (!site?.uberCustomerId || !site?.pickup?.address) return res.status(400).json({ error: 'Site not configured for Uber Direct' });
		const { dropoff, manifestItems, tip, externalId } = req.body || {};
		const delivery = await createDelivery({
			customerId: site.uberCustomerId,
			pickup: site.pickup,
			dropoff,
			manifestItems,
			tip,
			externalId,
		});
		// Record order
		const totalCents = (manifestItems || []).reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0) + (Number(tip) || 0);
		const orderPayload = {
			site: req.siteId,
			userId: req.user?.userId,
			userEmail: req.user?.email,
			items: (manifestItems || []).map((m) => ({ name: m.name, quantity: m.quantity, priceCents: m.price, size: m.size })),
			totalCents,
			tipCents: Number(tip) || 0,
			externalId,
			uberDeliveryId: delivery?.id || delivery?.delivery_id,
			dropoff,
		};
		if (req.app.locals.mockData) {
			if (!Array.isArray(req.app.locals.mockData.orders)) req.app.locals.mockData.orders = [];
			req.app.locals.mockData.orders.unshift({ _id: `o-${Date.now()}`, ...orderPayload });
		} else {
			await Order.create(orderPayload);
		}
		res.status(201).json(delivery);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

export default router;

