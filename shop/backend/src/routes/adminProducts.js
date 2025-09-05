import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';

const router = Router({ mergeParams: true });

router.get('/', requireAuth, async (req, res) => {
	try {
		const { siteId } = req.params;
		const { categoryId } = req.query;
		const filter = { site: siteId };
		if (categoryId) filter.categoryId = categoryId;
		const products = await Product.find(filter).sort({ name: 1 });
		res.json(products);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

router.post('/', requireAuth, async (req, res) => {
	try {
		const { siteId } = req.params;
		const payload = { ...req.body, site: siteId };
		// Validate category belongs to site
		const cat = await Category.findOne({ _id: payload.categoryId, site: siteId });
		if (!cat) return res.status(400).json({ error: 'Invalid category for site' });
		const created = await Product.create(payload);
		res.status(201).json(created);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

router.put('/:id', requireAuth, async (req, res) => {
	try {
		const { siteId, id } = req.params;
		const update = { ...req.body };
		if (update.categoryId) {
			const cat = await Category.findOne({ _id: update.categoryId, site: siteId });
			if (!cat) return res.status(400).json({ error: 'Invalid category for site' });
		}
		const product = await Product.findOneAndUpdate({ _id: id, site: siteId }, update, { new: true });
		if (!product) return res.status(404).json({ error: 'Not found' });
		res.json(product);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

router.delete('/:id', requireAuth, async (req, res) => {
	try {
		const { siteId, id } = req.params;
		const result = await Product.findOneAndDelete({ _id: id, site: siteId });
		if (!result) return res.status(404).json({ error: 'Not found' });
		res.status(204).end();
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

export default router;

