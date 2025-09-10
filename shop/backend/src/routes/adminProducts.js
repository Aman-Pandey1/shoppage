import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { saveMockData } from '../utils/mockStore.js';

const router = Router({ mergeParams: true });

router.get('/', requireAdmin, async (req, res) => {
	try {
		const { siteId } = req.params;
		const { categoryId } = req.query;
		const mock = req.app.locals.mockData;
		if (mock) {
			let list = mock.products.filter((p) => p.site === siteId);
			if (categoryId) list = list.filter((p) => String(p.categoryId) === String(categoryId));
			list.sort((a, b) => a.name.localeCompare(b.name));
			return res.json(list);
		}
		const filter = { site: siteId };
		if (categoryId) filter.categoryId = categoryId;
		const products = await Product.find(filter).sort({ name: 1 });
		res.json(products);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

router.post('/', requireAdmin, async (req, res) => {
	try {
		const { siteId } = req.params;
		const mock = req.app.locals.mockData;
		if (mock) {
			const payload = { ...req.body, site: siteId };
			const catOk = mock.categories.some((c) => c._id === payload.categoryId && c.site === siteId);
			if (!catOk) return res.status(400).json({ error: 'Invalid category for site' });
			const created = { _id: `p-${Date.now()}`, ...payload };
			mock.products.unshift(created);
			try { saveMockData(req.app.locals.mockData); } catch {}
			return res.status(201).json(created);
		}
		const payload = { ...req.body, site: siteId };
		const cat = await Category.findOne({ _id: payload.categoryId, site: siteId });
		if (!cat) return res.status(400).json({ error: 'Invalid category for site' });
		const created = await Product.create(payload);
		res.status(201).json(created);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

router.put('/:id', requireAdmin, async (req, res) => {
	try {
		const { siteId, id } = req.params;
		const mock = req.app.locals.mockData;
		if (mock) {
			const update = { ...req.body };
			if (update.categoryId) {
				const ok = mock.categories.some((c) => c._id === update.categoryId && c.site === siteId);
				if (!ok) return res.status(400).json({ error: 'Invalid category for site' });
			}
			const idx = mock.products.findIndex((p) => p._id === id && p.site === siteId);
			if (idx === -1) return res.status(404).json({ error: 'Not found' });
			const product = { ...mock.products[idx], ...update };
			mock.products[idx] = product;
			try { saveMockData(req.app.locals.mockData); } catch {}
			return res.json(product);
		}
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

router.delete('/:id', requireAdmin, async (req, res) => {
	try {
		const { siteId, id } = req.params;
		const mock = req.app.locals.mockData;
		if (mock) {
			const before = mock.products.length;
			mock.products = mock.products.filter((p) => !(p._id === id && p.site === siteId));
			if (mock.products.length === before) return res.status(404).json({ error: 'Not found' });
			try { saveMockData(req.app.locals.mockData); } catch {}
			return res.status(204).end();
		}
		const result = await Product.findOneAndDelete({ _id: id, site: siteId });
		if (!result) return res.status(404).json({ error: 'Not found' });
		res.status(204).end();
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

export default router;

