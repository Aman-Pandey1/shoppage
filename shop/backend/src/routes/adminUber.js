import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { tenantBySlug } from '../middleware/tenant.js';
import Site from '../models/Site.js';
import { requestQuote } from '../services/uberDirect.js';
import Stripe from 'stripe';
import { requestQuote as ddRequestQuote } from '../services/doordashDrive.js';

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
        creds: { clientId: site?.uberClientId, clientSecret: site?.uberClientSecret, env: site?.uberEnv }
      });
      return res.json({ ok: true, fee: quote?.fee, eta: quote?.dropoff_estimated_dt });
		} catch (err) {
			// Beautify common undeliverable errors
			const msg = String(err?.message || '');
			if (/address_undeliverable|Cannot find eligible product/i.test(msg)) {
				return res.status(400).json({ ok: false, error: 'Address undeliverable in Uber sandbox. Ensure pickup address is valid and within supported region, or try a nearby address.' });
			}
			return res.status(400).json({ ok: false, error: err.message });
		}
	} catch (err) {
		return res.status(400).json({ ok: false, error: err.message });
	}
});

// DoorDash health check: try a lightweight quote using site pickup to itself
router.get('/sites/:siteId/health/doordash', requireAdmin, async (req, res) => {
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
    if (!site.doordashStoreId || !hasPickupCfg) {
      return res.json({ ok: false, error: 'DoorDash not configured' });
    }
    try {
      const pickup = site.pickup?.address ? site.pickup : (Array.isArray(site.locations) && site.locations.length ? site.locations[0] : null);
      const testPhone = (pickup?.phone && /^\+?[1-9]\d{7,14}$/.test(String(pickup.phone).replace(/[^\d+]/g, '')))
        ? String(pickup.phone).replace(/[^\d+]/g, '') : '+10000000000';
      const quote = await ddRequestQuote({
        storeId: site.doordashStoreId,
        pickup,
        dropoff: {
          name: pickup?.name || 'Test',
          phone: testPhone,
          address: pickup.address,
        },
      });
      return res.json({ ok: true, fee: quote?.fee, eta: quote?.dropoff_estimated_dt, simulated: !!quote?.simulated });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

export default router;

// Stripe account status for site (charges_enabled etc.)
router.get('/sites/:siteId/health/stripe', requireAdmin, async (req, res) => {
  try {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return res.status(400).json({ ok: false, error: 'Missing STRIPE_SECRET_KEY' });
    const stripe = new Stripe(secret);
    const mock = req.app.locals.mockData;
    let site;
    if (mock) {
      site = mock.sites.find((s) => s._id === req.params.siteId);
    } else {
      site = await Site.findById(req.params.siteId);
    }
    if (!site) return res.status(404).json({ ok: false, error: 'Site not found' });
    const acct = site?.stripeAccountId;
    if (!acct) return res.json({ ok: false, error: 'Stripe Account ID not set' });
    const account = await stripe.accounts.retrieve(acct);
    const enabled = !!account?.charges_enabled;
    const payouts = !!account?.payouts_enabled;
    const detailsSubmitted = !!account?.details_submitted;
    return res.json({ ok: enabled, charges_enabled: enabled, payouts_enabled: payouts, details_submitted: detailsSubmitted, accountId: account?.id });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

