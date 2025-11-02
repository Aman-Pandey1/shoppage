import { Router } from 'express';
import { tenantBySlug } from '../middleware/tenant.js';
import { requireAuth } from '../middleware/auth.js';
import Order from '../models/Order.js';
import { saveMockData } from '../utils/mockStore.js';
import Site from '../models/Site.js';
import { requestQuote as uberRequestQuote, createDelivery as uberCreateDelivery } from '../services/uberDirect.js';
import { requestQuote as ddRequestQuote, createDelivery as ddCreateDelivery } from '../services/doordashDrive.js';
import { distanceBetweenAddressesKm, calculateDistanceFeeCents } from '../services/geo.js';
import { getNextOrderNumber } from '../utils/orderNumber.js';
import Category from '../models/Category.js';
import { normalizePhoneForCountry } from '../utils/phone.js';

function normalizeSelectedOptions(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((opt) => {
      const groupKey = String(opt?.groupKey || '').trim();
      const optionKey = String(opt?.optionKey || '').trim();
      if (!groupKey || !optionKey) return null;
      return {
        groupKey,
        groupLabel: opt?.groupLabel ? String(opt.groupLabel) : undefined,
        optionKey,
        optionLabel: opt?.optionLabel ? String(opt.optionLabel) : undefined,
        priceDelta: Number(opt?.priceDelta || 0) || 0,
      };
    })
    .filter(Boolean);
}

const router = Router();

router.use('/:slug', tenantBySlug);

// Delivery quote should be resilient: even if the third-party provider
// (Uber Direct / DoorDash Drive) is not fully configured in production,
// return a simulated distance-based quote so the user can proceed to checkout.
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
	    const isMock = !!req.app?.locals?.mockData;
	    const provider = site?.deliveryProvider || 'uber';

	    // Must have at least one pickup location to compute distance-based fee
	    if (!hasPickupCfg) {
	      return res.status(400).json({ error: 'No pickup location configured' });
	    }
    const { dropoff, pickupLocationIndex, itemsSubtotalCents } = req.body || {};
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
        // If the chosen pickup has a Google Place ID but no coordinates, attempt to resolve lat/lon once.
        const pickupRaw = locs[chosenIdx];
        const pickup = pickupRaw;
		if (!pickup) return res.status(400).json({ error: 'No pickup location configured' });
    // Compute distance; do not enforce a hard max-distance block here
    let distanceKm = null;
    try { distanceKm = await distanceBetweenAddressesKm(pickup.address, dropoff.address); } catch {}
	    // Decide if we can call live provider or should simulate
	    const hasUberConfig = !!site?.uberCustomerId && !!site?.uberClientId && !!site?.uberClientSecret;
	    const hasDoordashConfig = !!site?.doordashStoreId;
	    const canCallProvider = isMock || (provider === 'uber' ? hasUberConfig : hasDoordashConfig);

	    // Use selected provider when configured; otherwise simulate quote
	    let quote = null;
	    if (canCallProvider) {
	      try {
        quote = provider === 'doordash'
          ? await ddRequestQuote({ storeId: site.doordashStoreId, pickup, dropoff })
          : await uberRequestQuote({
              customerId: site.uberCustomerId,
              pickup,
              dropoff,
              creds: {
                clientId: site?.uberClientId,
                clientSecret: site?.uberClientSecret,
                env: site?.uberEnv,
                scopes: site?.uberTokenScopes,
                audience: String(site?.uberEnv || '').toLowerCase() === 'sandbox'
                  ? 'https://sandbox-api.uber.com'
                  : 'https://api.uber.com',
              },
            });
	      } catch (e) {
	        const msg = String(e?.message || '');
	        // Allow customers to proceed even if Uber app scopes are misconfigured
	        if (provider === 'uber' && /invalid_scope|Uber token error/i.test(msg)) {
	          quote = { id: `q-${Date.now()}`, simulated: true };
	        } else {
	          // If provider call fails for other reasons, fall back to simulated quote
	          quote = { id: `q-${Date.now()}`, simulated: true };
	        }
	      }
	    } else {
	      quote = { id: `q-${Date.now()}`, simulated: true };
	    }
    // Calculate delivery fee using admin-configured per-km rate (cents/km), rounded up
    const baseFee = (typeof site?.deliveryFeeCents === 'number' && isFinite(site.deliveryFeeCents))
      ? Math.max(0, Number(site.deliveryFeeCents))
      : 800;
    const fullDeliveryFeeCents = calculateDistanceFeeCents(distanceKm, baseFee);
    const split = !!site.splitDeliveryFee;
    const freeEnabled = !!site.freeDeliveryEnabled;
    const freeMin = (typeof site.freeDeliveryMinSubtotalCents === 'number')
      ? Math.max(0, Number(site.freeDeliveryMinSubtotalCents) || 0)
      : null;
    const itemsSubtotal = (typeof itemsSubtotalCents === 'number') ? Math.max(0, Math.round(Number(itemsSubtotalCents))) : null;
    const freeEligible = !!freeEnabled && freeMin !== null && itemsSubtotal !== null && itemsSubtotal >= freeMin;
    const customerDeliveryFeeCents = freeEligible ? 0 : (split ? Math.round(fullDeliveryFeeCents / 2) : fullDeliveryFeeCents);
      res.json({ ...quote, distanceKm, distanceFeeCents: fullDeliveryFeeCents, customerDeliveryFeeCents, pickupLocationIndex: chosenIdx, freeDeliveryApplied: !!freeEligible });
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

// Helpful response for accidental GET requests to the quote endpoint
router.get('/:slug/quote', (_req, res) => {
  res.status(405).json({ error: 'Use POST with JSON body: { dropoff: { address }, pickupLocationIndex }' });
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
	  const stripeSecretKey = site?.stripeSecretKey || process.env.STRIPE_SECRET_KEY || '';
	  const isStripeSandboxMode = /^sk_test_/i.test(String(stripeSecretKey || '').trim());
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
    // Block delivery when any item is from a pickup-only category
    try {
      const isPickupOnlyCategory = async (catId) => {
        if (!catId) return false;
        if (req.app.locals.mockData) {
          const cat = (req.app.locals.mockData.categories || []).find((c) => c.site === req.siteId && String(c._id) === String(catId));
          return !!(cat && cat.pickupOnly);
        }
        const found = await Category.findOne({ _id: catId, site: req.siteId });
        return !!(found && found.pickupOnly);
      };
      for (const it of (manifestItems || [])) {
        if (await isPickupOnlyCategory(it.categoryId)) {
          return res.status(400).json({ error: 'Cart contains pickup-only items. Delivery is not available.' });
        }
      }
    } catch {}
		// Ensure pickup has a valid E.164 phone for Uber
	    const pickupCountry = String(pickup?.address?.country || site?.country || 'CA').toUpperCase();
	    const normalizedPickupPhone = normalizePhoneForCountry(pickup?.phone, pickupCountry) || '+14155550123';
	    const safePickup = {
	      ...pickup,
	      phone: normalizedPickupPhone || '+14155550123',
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
    // Calculate delivery fee using admin-configured base when available
    const baseFee = (typeof site?.deliveryFeeCents === 'number' && isFinite(site.deliveryFeeCents))
      ? Math.max(0, Number(site.deliveryFeeCents))
      : 800;
    const distanceFeeCents = calculateDistanceFeeCents(distanceKm, baseFee);
    // Enforce payment before creating real delivery in non-mock environments
		if (!isMock) {
		  // If an externalId corresponds to an order, ensure it is paid. Otherwise block.
		  if (externalId) {
			const maybeOrder = await Order.findOne({ externalId });
			if (maybeOrder) {
			  const status = String(maybeOrder.status || '').toLowerCase();
			  const sandboxSatisfied = isStripeSandboxMode && (status === 'awaiting_payment' || status === 'created' || status === 'test_paid');
			  if (sandboxSatisfied && status !== 'paid') {
				try {
				  const meta = (maybeOrder.meta && typeof maybeOrder.meta === 'object') ? { ...maybeOrder.meta, sandboxPaymentOverride: true } : { sandboxPaymentOverride: true };
				  await Order.findByIdAndUpdate(maybeOrder._id, { status: 'paid', meta });
				} catch {}
			  }
			  if (!sandboxSatisfied && status !== 'paid') {
				return res.status(402).json({ error: 'Payment required before creating delivery' });
			  }
			}
		  }
		}
    // Use selected provider
	    const delivery = provider === 'doordash'
	      ? await ddCreateDelivery({ storeId: site.doordashStoreId, pickup: safePickup, dropoff: safeDropoff, manifestItems, tip: 0, externalId })
	      : await uberCreateDelivery({
          customerId: site.uberCustomerId,
          pickup: safePickup,
          dropoff: safeDropoff,
          manifestItems,
          tip: 0,
          externalId,
          creds: {
            clientId: site?.uberClientId,
            clientSecret: site?.uberClientSecret,
            env: site?.uberEnv,
            scopes: site?.uberTokenScopes,
            audience: String(site?.uberEnv || '').toLowerCase() === 'sandbox'
              ? 'https://sandbox-api.uber.com'
              : 'https://api.uber.com',
          },
        });
		// Record order
		const itemsTotal = (manifestItems || []).reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
    const isMockEnv = !!req.app?.locals?.mockData;
    const minOrderCents = isMockEnv ? 0 : Math.max(0, Number(process.env.MIN_ORDER_CENTS) || 5000);
    if (itemsTotal < minOrderCents) return res.status(400).json({ error: `Minimum total amount should be $${(minOrderCents/100).toFixed(2)} required for delivery` });
    const split = !!site.splitDeliveryFee;
    const fullDeliveryFeeCents = Number(distanceFeeCents) || 0;
    // Free delivery threshold based on items total BEFORE tax/fees
    const freeEnabled = !!site.freeDeliveryEnabled;
    const freeMin = (typeof site.freeDeliveryMinSubtotalCents === 'number')
      ? Math.max(0, Number(site.freeDeliveryMinSubtotalCents) || 0)
      : null;
    const freeEligible = !!freeEnabled && freeMin !== null && itemsTotal >= freeMin;
    const customerDeliveryFeeCents = freeEligible ? 0 : (split ? Math.round(fullDeliveryFeeCents / 2) : fullDeliveryFeeCents);
    const restaurantDeliveryFeeCents = freeEligible ? fullDeliveryFeeCents : (split ? (fullDeliveryFeeCents - customerDeliveryFeeCents) : 0);
		const taxCents = Math.round(itemsTotal * 0.05);
    const totalCents = itemsTotal + taxCents + customerDeliveryFeeCents;
		const trackingUrl = delivery?.tracking_url || delivery?.trackingUrl || delivery?.share_url || delivery?.tracking_url_v2 || '';
		const deliveryStatus = delivery?.status || delivery?.state || delivery?.current_status || '';
    const orderPayload = {
			site: req.siteId,
			userId: req.user?.userId,
			userEmail: req.user?.email,
		items: (manifestItems || []).map((m) => ({
		  name: m.name,
		  quantity: m.quantity,
		  priceCents: m.price,
		  size: m.size,
		  spiceLevel: m.spiceLevel,
		  flavor: m.flavor,
		  portion: m.portion,
		  quantityOption: m.quantityOption,
		  selectedOptions: normalizeSelectedOptions(m.selectedOptions),
		})),
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
			pickup: { location: safePickup },
      meta: { distanceKm, freeDeliveryApplied: !!freeEligible },
      notes: typeof notes === 'string' ? notes.slice(0, 1000) : undefined,
		};
		if (req.app.locals.mockData) {
			if (!Array.isArray(req.app.locals.mockData.orders)) req.app.locals.mockData.orders = [];
			const createdAt = new Date().toISOString();
      const nextSeq = ((req.app.locals.mockData.orderSeq || 1000) + 1);
      req.app.locals.mockData.orderSeq = nextSeq;
      req.app.locals.mockData.orders.unshift({ _id: `o-${Date.now()}`, createdAt, orderNumber: `BB-${nextSeq}`, ...orderPayload });
			try { saveMockData(req.app.locals.mockData); } catch {}
		} else {
      const orderNumber = await getNextOrderNumber(req.siteId);
      await Order.create({ ...orderPayload, orderNumber });
		}
    res.status(201).json({ ...delivery, distanceKm, distanceFeeCents: fullDeliveryFeeCents, customerDeliveryFeeCents, pickupLocationIndex: chosenIdx });
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

export default router;

