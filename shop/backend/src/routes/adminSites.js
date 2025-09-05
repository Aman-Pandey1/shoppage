import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import Site from '../models/Site.js';

const router = Router();

router.get('/', requireAuth, async (_req, res) => {
	try {
		const sites = await Site.find({}).sort({ createdAt: -1 });
		res.json(sites);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

router.post('/', requireAuth, async (req, res) => {
	try {
		const { name, slug, domains } = req.body || {};
		if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });
		const site = await Site.create({ name, slug, domains: domains || [], isActive: true });
		res.status(201).json(site);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

router.patch('/:siteId', requireAuth, async (req, res) => {
	try {
		const { siteId } = req.params;
		const { name, slug, domains, isActive } = req.body || {};
		const site = await Site.findByIdAndUpdate(siteId, { name, slug, domains, isActive }, { new: true });
		if (!site) return res.status(404).json({ error: 'Not found' });
		res.json(site);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

router.delete('/:siteId', requireAuth, async (req, res) => {
	try {
		const { siteId } = req.params;
		await Site.findByIdAndDelete(siteId);
		res.status(204).end();
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

export default router;

