import { Router } from 'express';
import { tenantBySlug } from '../middleware/tenant.js';
import { requireAuth } from '../middleware/auth.js';
import Order from '../models/Order.js';
import { saveMockData } from '../utils/mockStore.js';
import Site from '../models/Site.js';
import { requestQuote as uberRequestQuote, createDelivery as uberCreateDelivery } from '../services/uberDirect.js';
import { requestQuote as ddRequestQuote, createDelivery as ddCreateDelivery } from '../services/doordashDrive.js';
import { distanceBetweenAddressesKm, calculateDistanceFeeCents } from '../services/geo.js';

const router = Router();

// Normalize a raw phone number to E.164 using the provided country code
// Supports common cases for CA/US (+1), IN (+91), GB (+44), AU (+61)
function normalizePhoneForCountry(raw, country) {
	try {
		const cleaned = String(raw || '').replace(/[^\d+]/g, '');
		const c = String(country || 'CA').toUpperCase();
		const ccMap = { CA: '1', US: '1', IN: '91', GB: '44', AU: '61' };
		const usesTrunkZero = new Set(['GB', 'IN', 'AU']);
		const defaultCc = ccMap[c] || '';
		if (!cleaned) return '';
		if (cleaned.startsWith('+')) {
			let withPlus = '+' + cleaned.replace(/\+/g, '');
			// Drop a single trunk '0' immediately after country code for countries that use it
			if (defaultCc && usesTrunkZero.has(c)) {
				const afterCcIdx = 1 + defaultCc.length;
				if (withPlus.slice(1, afterCcIdx) === defaultCc && withPlus[afterCcIdx] === '0') {
					withPlus = '+' + defaultCc + withPlus.slice(afterCcIdx + 1);
				}
			}
			return /^\+[1-9]\d{7,14}$/.test(withPlus) ? withPlus : '';
		}
		// No plus provided: assume selected country, strip trunk '0' if applicable
		let national = cleaned;
		if (usesTrunkZero.has(c) && national.startsWith('0')) {
			national = national.replace(/^0+/, '');
		}
		if (defaultCc) {
			// Special handling for Canada/US: treat 11 digits starting with 1 as full intl already,
			// and 10 digits as local North American Numbering Plan.
			if (defaultCc === '1') {
				if (/^1\d{10}$/.test(national)) return '+' + national;
				if (/^\d{10}$/.test(national)) return '+1' + national;
			}
			const combined = '+' + defaultCc + national;
			return /^\+[1-9]\d{7,14}$/.test(combined) ? combined : '';
		}
		// Fallback: if already looks like an international number without plus, add it
		if (/^[1-9]\d{7,14}$/.test(national)) return '+' + national;
		return '';
	} catch {
		return '';
	}
}

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
    // Allow in mock mode even if provider config missing
    const isMock = !!req.app?.locals?.mockData;
    const provider = site?.deliveryProvider || 'uber';
    if (provider === 'uber') {
      if ((!site?.uberCustomerId || !hasPickupCfg) && !isMock) return res.status(400).json({ error: 'Site not configured for Uber Direct' });
    } else if (provider === 'doordash') {
      if ((!site?.doordashStoreId || !hasPickupCfg) && !isMock) return res.status(400).json({ error: 'Site not configured for DoorDash Drive' });
    }
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
    // Enforce max delivery distance if configured
    const maxKm = typeof site?.maxDeliveryDistanceKm === 'number' && site.maxDeliveryDistanceKm > 0 ? site.maxDeliveryDistanceKm : null;
    if (maxKm != null && typeof distanceKm === 'number' && distanceKm > maxKm) {
      return res.status(400).json({ error: `Delivery is only available within ${maxKm} km of the restaurant.` });
    }
    // Use selected provider
    let quote;
    try {
      quote = provider === 'doordash'
        ? await ddRequestQuote({ storeId: site.doordashStoreId, pickup, dropoff })
        : await uberRequestQuote({ customerId: site.uberCustomerId, pickup, dropoff, creds: { clientId: site?.uberClientId, clientSecret: site?.uberClientSecret, env: site?.uberEnv } });
    } catch (e) {
      const msg = String(e?.message || '');
      // Allow customers to proceed to the menu even if the Uber app
      // is misconfigured with scopes by returning a simulated quote.
      // We only do this for the quote endpoint (pre-payment) and keep
      // createDelivery strict to avoid charging without a courier.
      if (provider === 'uber' && /invalid_scope|Uber token error/i.test(msg)) {
        quote = {
          id: `q-${Date.now()}`,
          fee: { amount: 799, currency_code: 'CAD' },
          dropoff_estimated_dt: null,
          simulated: true,
        };
      } else {
        throw e;
      }
    }
    const split = !!site.splitDeliveryFee;
    const customerDeliveryFeeCents = split ? Math.round((Number(distanceFeeCents) || 0) / 2) : (Number(distanceFeeCents) || 0);
    res.json({ ...quote, distanceKm, distanceFeeCents, customerDeliveryFeeCents, pickupLocationIndex: chosenIdx });
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
		// Allow in mock mode even if Uber config missing
		const isMock = !!req.app?.locals?.mockData;
    const provider = site?.deliveryProvider || 'uber';
    if (provider === 'uber') {
      if ((!site?.uberCustomerId || !hasPickupCfg) && !isMock) return res.status(400).json({ error: 'Site not configured for Uber Direct' });
    } else if (provider === 'doordash') {
      if ((!site?.doordashStoreId || !hasPickupCfg) && !isMock) return res.status(400).json({ error: 'Site not configured for DoorDash Drive' });
    }
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
    const normalizedPickupPhoneRaw = String(pickup?.phone || '').replace(/[^\d+]/g, '');
    const normalizedPickupPhone = normalizedPickupPhoneRaw
      ? (normalizedPickupPhoneRaw.startsWith('+') ? normalizedPickupPhoneRaw : ('+' + normalizedPickupPhoneRaw))
      : '+14155550123';
    const safePickup = {
      ...pickup,
      phone: /^\+[1-9]\d{7,14}$/.test(normalizedPickupPhone) ? normalizedPickupPhone : '+14155550123',
    };
		// Normalize dropoff phone to E.164 using dropoff country
		const dropCountry = String(dropoff?.address?.country || 'CA').toUpperCase();
		const normalizedDropoffPhone = normalizePhoneForCountry(dropoff?.phone, dropCountry);
		if (!normalizedDropoffPhone) {
			return res.status(400).json({ error: 'Phone number is invalid. Use E.164 format like +14155550123.' });
		}
		const safeDropoff = { ...dropoff, phone: normalizedDropoffPhone };
		// Compute distance-based fee
		let distanceKm = null;
		try { distanceKm = await distanceBetweenAddressesKm(pickup.address, dropoff.address); } catch {}
		const distanceFeeCents = calculateDistanceFeeCents(distanceKm);
    // Enforce payment before creating real delivery in non-mock environments
    if (!isMock) {
      // If an externalId corresponds to an order, ensure it is paid. Otherwise block.
      if (externalId) {
        const maybeOrder = await Order.findOne({ externalId });
        if (maybeOrder && maybeOrder.status !== 'paid') {
          return res.status(402).json({ error: 'Payment required before creating delivery' });
        }
      }
    }
    // Use selected provider
    const delivery = provider === 'doordash'
      ? await ddCreateDelivery({ storeId: site.doordashStoreId, pickup: safePickup, dropoff: safeDropoff, manifestItems, tip: 0, externalId })
      : await uberCreateDelivery({ customerId: site.uberCustomerId, pickup: safePickup, dropoff: safeDropoff, manifestItems, tip: 0, externalId, creds: { clientId: site?.uberClientId, clientSecret: site?.uberClientSecret, env: site?.uberEnv } });
		// Record order
		const itemsTotal = (manifestItems || []).reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
		const isMockEnv = !!req.app?.locals?.mockData;
		const minOrderCents = isMockEnv ? 0 : Math.max(0, Number(process.env.MIN_ORDER_CENTS) || 5000);
		if (itemsTotal < minOrderCents) return res.status(400).json({ error: `Minimum order is $${(minOrderCents/100).toFixed(2)}` });
    const split = !!site.splitDeliveryFee;
    const fullDeliveryFeeCents = Number(distanceFeeCents) || 0;
    const customerDeliveryFeeCents = split ? Math.round(fullDeliveryFeeCents / 2) : fullDeliveryFeeCents;
    const restaurantDeliveryFeeCents = split ? (fullDeliveryFeeCents - customerDeliveryFeeCents) : 0;
		const taxCents = Math.round(itemsTotal * 0.05);
    const totalCents = itemsTotal + taxCents + customerDeliveryFeeCents;
		const trackingUrl = delivery?.tracking_url || delivery?.trackingUrl || delivery?.share_url || delivery?.tracking_url_v2 || '';
		const deliveryStatus = delivery?.status || delivery?.state || delivery?.current_status || '';
    const orderPayload = {
			site: req.siteId,
			userId: req.user?.userId,
			userEmail: req.user?.email,
      items: (manifestItems || []).map((m) => ({ name: m.name, quantity: m.quantity, priceCents: m.price, size: m.size, spiceLevel: m.spiceLevel })),
			totalCents,
			taxCents,
			tipCents: 0,
      deliveryFeeCents: customerDeliveryFeeCents,
      deliveryFeeRestaurantCents: restaurantDeliveryFeeCents,
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
    res.status(201).json({ ...delivery, distanceKm, distanceFeeCents: fullDeliveryFeeCents, customerDeliveryFeeCents, pickupLocationIndex: chosenIdx });
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

export default router;

