import { Router } from 'express';
import { tenantBySlug } from '../middleware/tenant.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';

const router = Router();

// Resolve site by :slug for all below
router.use('/:slug', tenantBySlug);

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
		const { categoryId } = req.query;
		if (mock) {
			let list = mock.products.filter((p) => p.site === req.siteId);
			if (categoryId) list = list.filter((p) => String(p.categoryId) === String(categoryId));
			list.sort((a, b) => a.name.localeCompare(b.name));
			return res.json(list);
		}
		const filter = { site: req.siteId };
		if (categoryId) filter.categoryId = categoryId;
		const products = await Product.find(filter).sort({ name: 1 });
		res.json(products);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

export default router;

