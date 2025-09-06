import Site from '../models/Site.js';

export async function tenantBySlug(req, res, next) {
	try {
		// Mock fallback: bypass DB when mock data is enabled
		if (req.app?.locals?.mockData) {
			const { slug } = req.params;
			const resolvedSlug = slug || 'default';
			req.site = { _id: 'mock-site', name: 'Default Site', slug: resolvedSlug, isActive: true };
			req.siteId = req.site._id;
			return next();
		}

		const { slug } = req.params;
		if (!slug) return res.status(400).json({ error: 'Missing site slug' });
		const site = await Site.findOne({ slug, isActive: true });
		if (!site) return res.status(404).json({ error: 'Site not found' });
		req.site = site;
		req.siteId = site._id;
		next();
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
}

export async function ensureSiteExists(req, res, next) {
	try {
		const { siteId } = req.params;
		if (!siteId) return res.status(400).json({ error: 'Missing siteId' });
		next();
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
}

