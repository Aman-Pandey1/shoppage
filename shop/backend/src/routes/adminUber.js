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
    const hasPickupCfg = !!(site.pickup?.address) || (Array.isArray(site.locations) && site.locations.length && site.locations[0]?.address);
    if (!site.uberCustomerId || !hasPickupCfg) {
      return res.json({ ok: false, error: 'Uber not configured' });
    }
		try {
      const pickup = site.pickup?.address ? site.pickup : (Array.isArray(site.locations) && site.locations.length ? site.locations[0] : null);
      const testPhone = (pickup?.phone && /^\+?[1-9]\d{7,14}$/.test(String(pickup.phone).replace(/[^\d+]/g, '')))
        ? String(pickup.phone).replace(/[^\d+]/g, '') : '+10000000000';
      const quote = await requestQuote({
        customerId: site.uberCustomerId,
        pickup,
        dropoff: {
          name: pickup?.name || 'Test',
          phone: testPhone,
          address: pickup.address,
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

