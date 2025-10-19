import { Router } from 'express';
import { tenantBySlug, tenantByHost } from '../middleware/tenant.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';

const router = Router();

// Normalize product shape for frontend compatibility
// - Ensure variants[] has a numeric `price` (fallback to `priceDelta` from legacy data)
function normalizeProductShape(p) {
  if (!p) return p;
  const obj = (typeof p.toObject === 'function') ? p.toObject() : { ...p };
  if (Array.isArray(obj.variants)) {
    obj.variants = obj.variants.map((v) => {
      const key = String(v?.key || v?.label || 'variant').trim();
      const label = String(v?.label || v?.key || 'Variant').trim();
      const price = Number((v?.price ?? v?.priceDelta) || 0) || 0;
      return { key, label, price };
    });
  }
  if (Array.isArray(obj.flavors)) {
    obj.flavors = obj.flavors.map((v) => {
      const key = String(v?.key || v?.label || 'flavor').trim();
      const label = String(v?.label || v?.key || 'Flavor').trim();
      const price = Number((v?.price ?? v?.priceDelta) || 0) || 0;
      return { key, label, price };
    });
  }
  if (Array.isArray(obj.portions)) {
    obj.portions = obj.portions.map((v) => {
      const key = String(v?.key || v?.label || 'portion').trim();
      const label = String(v?.label || v?.key || 'Portion').trim();
      const price = Number((v?.price ?? v?.priceDelta) || 0) || 0;
      return { key, label, price };
    });
  }
  if (Array.isArray(obj.quantities)) {
    obj.quantities = obj.quantities.map((v) => {
      const key = String(v?.key || v?.label || 'quantity').trim();
      const label = String(v?.label || v?.key || 'Quantity').trim();
      const price = Number((v?.price ?? v?.priceDelta) || 0) || 0;
      return { key, label, price };
    });
  }
  return obj;
}

// Infer a reasonable Canadian IANA time zone when not explicitly set
function inferCanadaTimeZoneFromSite(siteLike) {
  try {
    const getProvince = () => {
      const fromPickup = siteLike?.pickup?.address?.province;
      if (fromPickup) return String(fromPickup).toUpperCase();
      const firstLocProv = Array.isArray(siteLike?.locations) && siteLike.locations.length
        ? siteLike.locations[0]?.address?.province
        : undefined;
      return String(firstLocProv || '').toUpperCase();
    };
    const country = String(siteLike?.pickup?.address?.country || siteLike?.locations?.[0]?.address?.country || '').toUpperCase();
    if (country && country !== 'CA') return undefined;
    const prov = getProvince();
    const MAP = {
      NL: 'America/St_Johns',
      NS: 'America/Halifax',
      PE: 'America/Halifax',
      NB: 'America/Halifax',
      QC: 'America/Toronto',
      ON: 'America/Toronto',
      MB: 'America/Winnipeg',
      SK: 'America/Regina',
      AB: 'America/Edmonton',
      BC: 'America/Vancouver',
      YT: 'America/Whitehorse',
      NT: 'America/Yellowknife',
      NU: 'America/Iqaluit',
    };
    return MAP[prov] || undefined;
  } catch {
    return undefined;
  }
}

// Resolve by current request host -> return site basics
router.get('/host-site', tenantByHost, async (req, res) => {
	try {
		const { site } = req;
		return res.json({ siteId: req.siteId, slug: site.slug, name: site.name });
	} catch (err) {
		return res.status(400).json({ error: err.message });
	}
});

// Resolve site by :slug for all below
router.use('/:slug', tenantBySlug);

// Public config for frontend: expose safe, public keys
// This endpoint returns only non-sensitive configuration intended for the browser.
router.get('/:slug/public-config', async (req, res) => {
  try {
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || '';
    return res.json({ googleMapsApiKey });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Site basics by slug (for UI display or tagging external refs)
router.get('/:slug/site', async (req, res) => {
  try {
    const { site } = req;
    // Expose min order so frontend can display requirement in delivery modal
    const minOrderCents = (typeof site.minOrderCents === 'number')
      ? Math.max(0, Number(site.minOrderCents) || 0)
      : Math.max(0, Number(process.env.MIN_ORDER_CENTS) || 5000);
    // Also expose coupon minimum subtotal so frontend can determine discount eligibility
    const couponMinSubtotalCents = (typeof site.couponMinSubtotalCents === 'number')
      ? Math.max(0, Number(site.couponMinSubtotalCents) || 0)
      : Math.max(0, Number(process.env.COUPON_MIN_SUBTOTAL_CENTS) || 5000);
    // Expose free-delivery configuration for client UX
    const freeDeliveryEnabled = !!site.freeDeliveryEnabled;
    const freeDeliveryMinSubtotalCents = (typeof site.freeDeliveryMinSubtotalCents === 'number')
      ? Math.max(0, Number(site.freeDeliveryMinSubtotalCents) || 0)
      : undefined;
    return res.json({
      siteId: req.siteId,
      slug: site.slug,
      name: site.name,
      brandColor: site.brandColor,
      headerColor: site.headerColor,
      timeZone: site.timeZone,
      deliveryFeeCents: Number(site.deliveryFeeCents) || 0,
      splitDeliveryFee: !!site.splitDeliveryFee,
      maxDeliveryDistanceKm: (typeof site.maxDeliveryDistanceKm === 'number' ? site.maxDeliveryDistanceKm : undefined),
      logoUrl: site.logoUrl,
      bannerImageUrl: site.bannerImageUrl,
      logoLinkUrl: site.logoLinkUrl,
      tagline: site.tagline || '',
      supportWhatsappPhone: site.supportWhatsappPhone || '',
      minOrderCents,
      couponMinSubtotalCents,
      freeDeliveryEnabled,
      freeDeliveryMinSubtotalCents,
      currency: (site.currency || String(process.env.STRIPE_CURRENCY || 'usd').toLowerCase()),
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Public: list of pickup locations for a site (falls back to legacy single pickup)
router.get('/:slug/locations', async (req, res) => {
  try {
    const { site } = req;
    const mock = req.app.locals.mockData;
    if (mock) {
      const s = mock.sites.find((x) => x._id === req.siteId) || {};
      const fromLegacy = s?.pickup ? [{
        name: s.pickup.name,
        phone: s.pickup.phone,
        address: s.pickup.address,
      }] : [];
      return res.json(Array.isArray(s?.locations) && s.locations.length ? s.locations : fromLegacy);
    }
    const list = Array.isArray(site.locations) && site.locations.length
      ? site.locations
      : (site.pickup ? [{ name: site.pickup.name, phone: site.pickup.phone, address: site.pickup.address }] : []);
    return res.json(list);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Public: get opening hours for a site
router.get('/:slug/hours', async (req, res) => {
  try {
    const { site } = req;
    const defaultHours = {
      // Default store hours: 10:00 AM – 10:00 PM (last order 9:45 PM)
      mon: { open: '10:00', close: '22:00', closed: false },
      tue: { open: '10:00', close: '22:00', closed: false },
      wed: { open: '10:00', close: '22:00', closed: false },
      thu: { open: '10:00', close: '22:00', closed: false },
      fri: { open: '10:00', close: '22:00', closed: false },
      sat: { open: '10:00', close: '22:00', closed: false },
      sun: { open: '10:00', close: '22:00', closed: false },
    };
    const mock = req.app.locals.mockData;
    if (mock) {
      const s = mock.sites.find((x) => x._id === req.siteId) || {};
      const resolvedTz = s.timeZone || inferCanadaTimeZoneFromSite(s) || undefined;
      return res.json({ hours: s.hours || defaultHours, timeZone: resolvedTz });
    }
    const resolvedTz = site.timeZone || inferCanadaTimeZoneFromSite(site) || undefined;
    return res.json({ hours: site.hours || defaultHours, timeZone: resolvedTz });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Public: list of supported cities for delivery selection
router.get('/:slug/cities', async (req, res) => {
  try {
    const { site } = req;
    const mock = req.app.locals.mockData;
    if (mock) {
      const s = mock.sites.find((x) => x._id === req.siteId) || {};
      return res.json(Array.isArray(s?.cities) ? s.cities : []);
    }
    return res.json(Array.isArray(site.cities) ? site.cities : []);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/:slug/categories', async (req, res) => {
	try {
		const mock = req.app.locals.mockData;
		if (mock) {
			const categories = mock.categories.filter((c) => c.site === req.siteId).sort((a, b) => (a.sortIndex - b.sortIndex) || a.name.localeCompare(b.name));
			return res.json(categories);
		}
		const categories = await Category.find({ site: req.siteId }).sort({ sortIndex: 1, name: 1 });
		res.json(categories);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

router.get('/:slug/products', async (req, res) => {
	try {
		const mock = req.app.locals.mockData;
		const { categoryId, veg, isVeg } = req.query;
		if (mock) {
			let list = mock.products.filter((p) => p.site === req.siteId);
			if (categoryId) list = list.filter((p) => String(p.categoryId) === String(categoryId));
			// veg filter: veg=veg|nonveg or isVeg=true|false
			let vegFilter = null;
			if (typeof veg === 'string') {
				if (veg.toLowerCase() === 'veg') vegFilter = true;
				if (veg.toLowerCase() === 'nonveg') vegFilter = false;
			}
			if (typeof isVeg === 'string') {
				if (isVeg.toLowerCase() === 'true') vegFilter = true;
				if (isVeg.toLowerCase() === 'false') vegFilter = false;
			}
			if (vegFilter !== null) list = list.filter((p) => (typeof p.isVeg === 'boolean' ? p.isVeg : true) === vegFilter);
      list.sort((a, b) => a.name.localeCompare(b.name));
      return res.json(list.map(normalizeProductShape));
		}
		const filter = { site: req.siteId };
		if (categoryId) filter.categoryId = categoryId;
		if (typeof veg === 'string') {
			if (veg.toLowerCase() === 'veg') filter.isVeg = true;
			if (veg.toLowerCase() === 'nonveg') filter.isVeg = false;
		}
		if (typeof isVeg === 'string') {
			if (isVeg.toLowerCase() === 'true') filter.isVeg = true;
			if (isVeg.toLowerCase() === 'false') filter.isVeg = false;
		}
    const products = await Product.find(filter)
      .select('name description imageUrl price categoryId isVeg spiceLevels variants flavors portions quantities extraOptionGroups')
      .sort({ name: 1 });
    res.json(products.map(normalizeProductShape));
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

// Public: validate coupon by code for a site
router.get('/:slug/coupon/:code', async (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const mock = req.app.locals.mockData;
    if (mock) {
      const site = req.siteId;
      const list = mock.coupons || [];
      const found = list.find((c) => c.site === site && c.code === code);
      if (!found) return res.status(404).json({ error: 'Invalid coupon' });
      return res.json({ code: found.code, percent: Number(found.percent) || 0 });
    }
    const found = await Coupon.findOne({ site: req.siteId, code });
    if (!found) return res.status(404).json({ error: 'Invalid coupon' });
    return res.json({ code: found.code, percent: Number(found.percent) || 0 });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Public: get the latest coupon for a site (for auto-apply)
router.get('/:slug/default-coupon', async (req, res) => {
  try {
    const mock = req.app.locals.mockData;
    if (mock) {
      const site = req.siteId;
      const list = (mock.coupons || []).filter((c) => c.site === site);
      if (!list.length) return res.status(404).json({ error: 'No coupons' });
      const sorted = list.slice().sort((a, b) => {
        const ta = new Date(a.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || 0).getTime();
        return tb - ta;
      });
      const chosen = sorted[0];
      return res.json({ code: chosen.code, percent: Number(chosen.percent) || 0 });
    }
    const found = await Coupon.findOne({ site: req.siteId }).sort({ createdAt: -1 });
    if (!found) return res.status(404).json({ error: 'No coupons' });
    return res.json({ code: found.code, percent: Number(found.percent) || 0 });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;

