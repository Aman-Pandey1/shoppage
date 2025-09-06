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

function extractHost(req) {
	// Prefer X-Forwarded-Host when behind proxies
	let host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString();
	if (host.includes(',')) host = host.split(',')[0];
	if (host.includes(':')) host = host.split(':')[0];
	return host.trim().toLowerCase();
}

export async function tenantByHost(req, res, next) {
	try {
		const host = extractHost(req);
		if (!host) {
			return res.status(400).json({ error: 'Host header missing' });
		}

		// Mock support
		if (req.app?.locals?.mockData) {
			const mock = req.app.locals.mockData;
			let site = mock.sites.find((s) => (Array.isArray(s.domains) ? s.domains.map((d) => d.toLowerCase()) : []).includes(host));
			if (!site) {
				// Fallback to default mock site
				site = mock.sites.find((s) => s.slug === 'default') || mock.sites[0];
			}
			if (!site) return res.status(404).json({ error: 'Site not found for host' });
			req.site = site;
			req.siteId = site._id;
			return next();
		}

		// DB-backed
		let site = await Site.findOne({ domains: host, isActive: true });
		if (!site && host.startsWith('www.')) {
			const alt = host.replace(/^www\./, '');
			site = await Site.findOne({ domains: alt, isActive: true });
		}
		if (!site && !host.startsWith('www.')) {
			const alt = `www.${host}`;
			site = await Site.findOne({ domains: alt, isActive: true });
		}
		if (!site) {
			// As a last resort, show default site if present
			site = await Site.findOne({ slug: 'default', isActive: true });
		}
		if (!site) return res.status(404).json({ error: 'Site not found for host' });
		req.site = site;
		req.siteId = site._id;
		next();
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
}

