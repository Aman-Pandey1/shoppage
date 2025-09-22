import { Router } from 'express';
import { tenantBySlug } from '../middleware/tenant.js';
import { requireAuth } from '../middleware/auth.js';
import Order from '../models/Order.js';
import { saveMockData } from '../utils/mockStore.js';
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
    const { dropoff, pickupLocationIndex } = req.body || {};
		if (!dropoff?.address?.streetAddress) return res.status(400).json({ error: 'Invalid dropoff address' });
    // Allow selecting a pickup location from configured list
    let pickup = site.pickup || (Array.isArray(site.locations) && site.locations.length ? site.locations[0] : null);
    if (typeof pickupLocationIndex === 'number' && Array.isArray(site.locations) && site.locations[pickupLocationIndex]) {
      pickup = site.locations[pickupLocationIndex];
    }
    if (!pickup) return res.status(400).json({ error: 'No pickup location configured' });
		const quote = await requestQuote({
			customerId: site.uberCustomerId,
      pickup,
			dropoff,
		});
		res.json(quote);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

router.post('/:slug/create', requireAuth, async (req, res) => {
	try {
		const mock = req.app.locals.mockData;
		let site;
		if (mock) {
			site = mock.sites.find((s) => s._id === req.siteId);
		} else {
			site = await Site.findById(req.siteId);
		}
		if (!site?.uberCustomerId || !site?.pickup?.address) return res.status(400).json({ error: 'Site not configured for Uber Direct' });
    const { dropoff, manifestItems, tip, externalId, pickupLocationIndex } = req.body || {};
    let pickup = site.pickup || (Array.isArray(site.locations) && site.locations.length ? site.locations[0] : null);
    if (typeof pickupLocationIndex === 'number' && Array.isArray(site.locations) && site.locations[pickupLocationIndex]) {
      pickup = site.locations[pickupLocationIndex];
    }
    if (!pickup) return res.status(400).json({ error: 'No pickup location configured' });
		const delivery = await createDelivery({
			customerId: site.uberCustomerId,
      pickup,
			dropoff,
			manifestItems,
			tip,
			externalId,
		});
		// Record order
		const itemsTotal = (manifestItems || []).reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
		if (itemsTotal < 5000) return res.status(400).json({ error: 'Minimum order is $50.00' });
		const deliveryFeeCents = Number(site.deliveryFeeCents) || 0;
		const totalCents = itemsTotal + deliveryFeeCents + (Number(tip) || 0);
		const trackingUrl = delivery?.tracking_url || delivery?.trackingUrl || delivery?.share_url || delivery?.tracking_url_v2 || '';
		const deliveryStatus = delivery?.status || delivery?.state || delivery?.current_status || '';
		const orderPayload = {
			site: req.siteId,
			userId: req.user?.userId,
			userEmail: req.user?.email,
			items: (manifestItems || []).map((m) => ({ name: m.name, quantity: m.quantity, priceCents: m.price, size: m.size })),
			totalCents,
			tipCents: Number(tip) || 0,
			deliveryFeeCents,
			externalId,
			uberDeliveryId: delivery?.id || delivery?.delivery_id,
      uberTrackingUrl: trackingUrl,
      uberStatus: deliveryStatus,
      fulfillmentType: 'delivery',
			dropoff,
		};
		if (req.app.locals.mockData) {
			if (!Array.isArray(req.app.locals.mockData.orders)) req.app.locals.mockData.orders = [];
			const createdAt = new Date().toISOString();
			req.app.locals.mockData.orders.unshift({ _id: `o-${Date.now()}`, createdAt, ...orderPayload });
			try { saveMockData(req.app.locals.mockData); } catch {}
		} else {
			await Order.create(orderPayload);
		}
		res.status(201).json(delivery);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

export default router;

