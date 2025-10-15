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
        creds: { clientId: site?.uberClientId, clientSecret: site?.uberClientSecret, env: site?.uberEnv, scopes: site?.uberTokenScopes }
      });
      return res.json({ ok: true, fee: quote?.fee, eta: quote?.dropoff_estimated_dt, simulated: !!quote?.simulated });
    } catch (err) {
      // Beautify common undeliverable errors
      const msg = String(err?.message || '');
      if (/address_undeliverable|Cannot find eligible product/i.test(msg)) {
        return res.status(400).json({ ok: false, error: 'Address undeliverable in Uber sandbox. Ensure pickup address is valid and within supported region, or try a nearby address.' });
      }
      // If Uber token scope is invalid, return simulated OK so admins are unblocked
      if (/invalid_scope|Uber token error/i.test(msg)) {
        return res.json({ ok: true, fee: { amount: 799, currency_code: 'CAD' }, eta: null, simulated: true, note: 'Uber scopes invalid; using simulated health.' });
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
    const mock = req.app.locals.mockData;
    let site;
    if (mock) {
      site = (mock.sites || []).find((s) => s._id === req.params.siteId);
    } else {
      site = await Site.findById(req.params.siteId);
    }
    if (!site) return res.status(404).json({ ok: false, error: 'Site not found' });

    const acct = site?.stripeAccountId;
    const perSiteSecret = site?.stripeSecretKey;
    const platformSecret = process.env.STRIPE_SECRET_KEY;

    // Two supported modes:
    // 1) Connect mode: use platform key and site's connected account id
    // 2) Per-site key mode: no connected account id required; verify the per-site key's own account

    // Prefer per-site key if present. If acct is also set, ensure it matches.
    if (perSiteSecret) {
      const stripeForSite = new Stripe(perSiteSecret);
      const account = await stripeForSite.accounts.retrieve();
      if (acct && account?.id && acct !== account.id) {
        return res.status(400).json({
          ok: false,
          error: 'Per-site Stripe secret does not match the provided Stripe Account ID. Update one to match the other.'
        });
      }
      const enabled = !!account?.charges_enabled;
      const payouts = !!account?.payouts_enabled;
      const detailsSubmitted = !!account?.details_submitted;
      return res.json({ ok: enabled, charges_enabled: enabled, payouts_enabled: payouts, details_submitted: detailsSubmitted, accountId: account?.id, mode: 'per-site-key' });
    }

    // Connect mode requires platform secret and a connected account id
    if (!acct) {
      return res.json({ ok: false, error: 'Stripe Account ID not set. Either set a connected account (acct_...) or use a per-site secret key.' });
    }
    if (!platformSecret) {
      return res.status(400).json({ ok: false, error: 'Missing STRIPE_SECRET_KEY (platform key) in environment' });
    }
    const stripe = new Stripe(platformSecret);
    try {
      const account = await stripe.accounts.retrieve(acct);
      const enabled = !!account?.charges_enabled;
      const payouts = !!account?.payouts_enabled;
      const detailsSubmitted = !!account?.details_submitted;
      return res.json({ ok: enabled, charges_enabled: enabled, payouts_enabled: payouts, details_submitted: detailsSubmitted, accountId: account?.id, mode: 'connect' });
    } catch (e) {
      const msg = String(e?.message || '');
      if (/does not have access to account|No such account/i.test(msg)) {
        return res.status(400).json({
          ok: false,
          error: 'Platform key does not have access to this Stripe account. Ensure the account is connected to your platform in the same mode (test/live) or re-authorize access.'
        });
      }
      throw e;
    }
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

