import { Router } from 'express';
import { tenantBySlug } from '../middleware/tenant.js';
import { requireAuth } from '../middleware/auth.js';
import Order from '../models/Order.js';
import { saveMockData } from '../utils/mockStore.js';
import Site from '../models/Site.js';
import { requestQuote, createDelivery } from '../services/uberDirect.js';
import { distanceBetweenAddressesKm, calculateDistanceFeeCents } from '../services/geo.js';

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
		const hasPickupCfg = !!(site?.pickup?.address) || (Array.isArray(site?.locations) && site.locations.length && site.locations[0]?.address);
		if (!site?.uberCustomerId || !hasPickupCfg) return res.status(400).json({ error: 'Site not configured for Uber Direct' });
		const { dropoff, pickupLocationIndex } = req.body || {};
		if (!dropoff?.address?.streetAddress) return res.status(400).json({ error: 'Invalid dropoff address' });
		// Determine pickup location: use provided index if valid, otherwise choose nearest to dropoff
		const locs = (Array.isArray(site.locations) && site.locations.length)
			? site.locations
			: (site.pickup ? [site.pickup] : []);
		if (!locs.length) return res.status(400).json({ error: 'No pickup location configured' });
		let chosenIdx = 0;
		if (typeof pickupLocationIndex === 'number' && locs[pickupLocationIndex]) {
			chosenIdx = pickupLocationIndex;
		} else {
			// Find nearest
			let minDist = Infinity;
			for (let i = 0; i < locs.length; i++) {
				try {
					const km = await distanceBetweenAddressesKm(locs[i].address, dropoff.address);
					if (typeof km === 'number' && km < minDist) { minDist = km; chosenIdx = i; }
				} catch {}
			}
		}
		const pickup = locs[chosenIdx];
		if (!pickup) return res.status(400).json({ error: 'No pickup location configured' });
		// Compute distance-based delivery fee
		let distanceKm = null;
		try { distanceKm = await distanceBetweenAddressesKm(pickup.address, dropoff.address); } catch {}
		const distanceFeeCents = calculateDistanceFeeCents(distanceKm);
		const quote = await requestQuote({
			customerId: site.uberCustomerId,
			pickup,
			dropoff,
		});
		res.json({ ...quote, distanceKm, distanceFeeCents, pickupLocationIndex: chosenIdx });
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
		const hasPickupCfg = !!(site?.pickup?.address) || (Array.isArray(site?.locations) && site.locations.length && site.locations[0]?.address);
		if (!site?.uberCustomerId || !hasPickupCfg) return res.status(400).json({ error: 'Site not configured for Uber Direct' });
		const { dropoff, manifestItems, externalId, pickupLocationIndex, notes } = req.body || {};
		const locs = (Array.isArray(site.locations) && site.locations.length)
			? site.locations
			: (site.pickup ? [site.pickup] : []);
		if (!locs.length) return res.status(400).json({ error: 'No pickup location configured' });
		let chosenIdx = 0;
		if (typeof pickupLocationIndex === 'number' && locs[pickupLocationIndex]) {
			chosenIdx = pickupLocationIndex;
		} else {
			// Choose nearest to dropoff
			let minDist = Infinity;
			for (let i = 0; i < locs.length; i++) {
				try {
					const km = await distanceBetweenAddressesKm(locs[i].address, dropoff.address);
					if (typeof km === 'number' && km < minDist) { minDist = km; chosenIdx = i; }
				} catch {}
			}
		}
		let pickup = locs[chosenIdx];
		if (!pickup) return res.status(400).json({ error: 'No pickup location configured' });
		// Ensure pickup has a valid E.164 phone for Uber
		const safePickup = {
			...pickup,
			phone: (pickup?.phone && /^\+?[1-9]\d{7,14}$/.test(String(pickup.phone).replace(/[^\d+]/g, '')))
				? String(pickup.phone).replace(/[^\d+]/g, '')
				: '+10000000000',
		};
		// Compute distance-based fee
		let distanceKm = null;
		try { distanceKm = await distanceBetweenAddressesKm(pickup.address, dropoff.address); } catch {}
		const distanceFeeCents = calculateDistanceFeeCents(distanceKm);
		const delivery = await createDelivery({
			customerId: site.uberCustomerId,
			pickup: safePickup,
			dropoff,
			manifestItems,
			tip: 0,
			externalId,
		});
		// Record order
    const itemsTotal = (manifestItems || []).reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
		if (itemsTotal < 5000) return res.status(400).json({ error: 'Minimum order is $50.00' });
		const deliveryFeeCents = Number(distanceFeeCents) || 0;
		const taxCents = Math.round(itemsTotal * 0.05);
		const totalCents = itemsTotal + taxCents + deliveryFeeCents;
		const trackingUrl = delivery?.tracking_url || delivery?.trackingUrl || delivery?.share_url || delivery?.tracking_url_v2 || '';
		const deliveryStatus = delivery?.status || delivery?.state || delivery?.current_status || '';
		const orderPayload = {
			site: req.siteId,
			userId: req.user?.userId,
			userEmail: req.user?.email,
			items: (manifestItems || []).map((m) => ({ name: m.name, quantity: m.quantity, priceCents: m.price, size: m.size })),
			totalCents,
			taxCents,
			tipCents: 0,
			deliveryFeeCents,
			externalId,
			uberDeliveryId: delivery?.id || delivery?.delivery_id,
      uberTrackingUrl: trackingUrl,
      uberStatus: deliveryStatus,
      fulfillmentType: 'delivery',
			dropoff,
			pickup: { location: pickup },
      meta: { distanceKm },
      notes: typeof notes === 'string' ? notes.slice(0, 1000) : undefined,
		};
		if (req.app.locals.mockData) {
			if (!Array.isArray(req.app.locals.mockData.orders)) req.app.locals.mockData.orders = [];
			const createdAt = new Date().toISOString();
			req.app.locals.mockData.orders.unshift({ _id: `o-${Date.now()}`, createdAt, ...orderPayload });
			try { saveMockData(req.app.locals.mockData); } catch {}
		} else {
			await Order.create(orderPayload);
		}
		res.status(201).json({ ...delivery, distanceKm, distanceFeeCents, pickupLocationIndex: chosenIdx });
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

export default router;

