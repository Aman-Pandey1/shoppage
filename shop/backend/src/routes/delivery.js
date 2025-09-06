import { Router } from 'express';
import { tenantBySlug } from '../middleware/tenant.js';
import Site from '../models/Site.js';
import { requestQuote, createDelivery } from '../services/uberDirect.js';

const router = Router();

router.use('/:slug', tenantBySlug);

router.post('/:slug/quote', async (req, res) => {
	try {
		const site = await Site.findById(req.siteId);
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

router.post('/:slug/create', async (req, res) => {
	try {
		const site = await Site.findById(req.siteId);
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
		res.status(201).json(delivery);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

export default router;

