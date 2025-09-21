import { Router } from 'express';
import { tenantBySlug, tenantByHost } from '../middleware/tenant.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';

const router = Router();

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

// Site basics by slug (for UI display or tagging external refs)
router.get('/:slug/site', async (req, res) => {
  try {
    const { site } = req;
    return res.json({ siteId: req.siteId, slug: site.slug, name: site.name, brandColor: site.brandColor });
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
			return res.json(list);
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
		const products = await Product.find(filter).sort({ name: 1 });
		res.json(products);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

export default router;

