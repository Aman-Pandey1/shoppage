import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { tenantBySlug } from '../middleware/tenant.js';
import Site from '../models/Site.js';
import { requestQuote } from '../services/uberDirect.js';

const router = Router();

// Quick health check: try a lightweight quote using site pickup to itself
router.get('/sites/:siteId/health', requireAdmin, async (req, res) => {
	try {
		const mock = req.app.locals.mockData;
		let site;
		if (mock) {
			site = mock.sites.find((s) => s._id === req.params.siteId);
		} else {
			site = await Site.findById(req.params.siteId);
		}
		if (!site) return res.status(404).json({ ok: false, error: 'Site not found' });
		if (!site.uberCustomerId || !site.pickup?.address) {
			return res.json({ ok: false, error: 'Uber not configured' });
		}
		try {
			const quote = await requestQuote({
				customerId: site.uberCustomerId,
				pickup: site.pickup,
				dropoff: {
					name: site.pickup?.name || 'Test',
					phone: site.pickup?.phone || '+10000000000',
					address: site.pickup.address,
				},
			});
			return res.json({ ok: true, fee: quote?.fee, eta: quote?.dropoff_estimated_dt });
		} catch (err) {
			return res.status(400).json({ ok: false, error: err.message });
		}
	} catch (err) {
		return res.status(400).json({ ok: false, error: err.message });
	}
});

export default router;

