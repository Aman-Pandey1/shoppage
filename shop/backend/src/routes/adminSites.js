import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import Site from '../models/Site.js';
import { saveMockData } from '../utils/mockStore.js';

const router = Router();

router.get('/', requireAdmin, async (_req, res) => {
	try {
		const mock = _req.app.locals.mockData;
		if (mock) {
			return res.json([...mock.sites]);
		}
		const sites = await Site.find({}).sort({ createdAt: -1 });
		res.json(sites);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

router.post('/', requireAdmin, async (req, res) => {
	try {
		const { name, slug, domains, uberCustomerId, pickup } = req.body || {};
		if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });
		const mock = req.app.locals.mockData;
		if (mock) {
			const created = { _id: `site-${Date.now()}`, name, slug, domains: domains || [], uberCustomerId, pickup, isActive: true };
			mock.sites.unshift(created);
			try { saveMockData(req.app.locals.mockData); } catch {}
			return res.status(201).json(created);
		}
		const site = await Site.create({ name, slug, domains: domains || [], uberCustomerId, pickup, isActive: true });
		res.status(201).json(site);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

router.patch('/:siteId', requireAdmin, async (req, res) => {
	try {
		const { siteId } = req.params;
		const { name, slug, domains, isActive, uberCustomerId, pickup } = req.body || {};
		const mock = req.app.locals.mockData;
		if (mock) {
			const idx = mock.sites.findIndex((s) => s._id === siteId);
			if (idx === -1) return res.status(404).json({ error: 'Not found' });
			const updated = { ...mock.sites[idx], ...(name !== undefined ? { name } : {}), ...(slug !== undefined ? { slug } : {}), ...(domains !== undefined ? { domains } : {}), ...(isActive !== undefined ? { isActive } : {}), ...(uberCustomerId !== undefined ? { uberCustomerId } : {}), ...(pickup !== undefined ? { pickup } : {}) };
			mock.sites[idx] = updated;
			try { saveMockData(req.app.locals.mockData); } catch {}
			return res.json(updated);
		}
		const site = await Site.findByIdAndUpdate(siteId, { name, slug, domains, isActive, uberCustomerId, pickup }, { new: true });
		if (!site) return res.status(404).json({ error: 'Not found' });
		res.json(site);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

router.delete('/:siteId', requireAdmin, async (req, res) => {
	try {
		const { siteId } = req.params;
		const mock = req.app.locals.mockData;
		if (mock) {
			const before = mock.sites.length;
			mock.sites = mock.sites.filter((s) => s._id !== siteId);
			if (mock.sites.length === before) return res.status(404).json({ error: 'Not found' });
			mock.categories = mock.categories.filter((c) => c.site !== siteId);
			mock.products = mock.products.filter((p) => p.site !== siteId);
			try { saveMockData(req.app.locals.mockData); } catch {}
			return res.status(204).end();
		}
		await Site.findByIdAndDelete(siteId);
		res.status(204).end();
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

export default router;

