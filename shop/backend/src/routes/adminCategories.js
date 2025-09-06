import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import Category from '../models/Category.js';

const router = Router({ mergeParams: true });

router.get('/', requireAuth, async (req, res) => {
	try {
		const { siteId } = req.params;
		const mock = req.app.locals.mockData;
		if (mock) {
			const list = mock.categories.filter((c) => c.site === siteId).sort((a, b) => (a.sortIndex - b.sortIndex) || a.name.localeCompare(b.name));
			return res.json(list);
		}
		const categories = await Category.find({ site: siteId }).sort({ sortIndex: 1, name: 1 });
		res.json(categories);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

router.post('/', requireAuth, async (req, res) => {
	try {
		const { siteId } = req.params;
		const mock = req.app.locals.mockData;
		if (mock) {
			const created = { _id: `c-${Date.now()}`, ...req.body, site: siteId };
			mock.categories.unshift(created);
			return res.status(201).json(created);
		}
		const payload = { ...req.body, site: siteId };
		const created = await Category.create(payload);
		res.status(201).json(created);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

router.patch('/:id', requireAuth, async (req, res) => {
	try {
		const { siteId, id } = req.params;
		const mock = req.app.locals.mockData;
		if (mock) {
			const idx = mock.categories.findIndex((c) => c._id === id && c.site === siteId);
			if (idx === -1) return res.status(404).json({ error: 'Not found' });
			const updated = { ...mock.categories[idx], ...req.body };
			mock.categories[idx] = updated;
			return res.json(updated);
		}
		const updated = await Category.findOneAndUpdate({ _id: id, site: siteId }, req.body, { new: true });
		if (!updated) return res.status(404).json({ error: 'Not found' });
		res.json(updated);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

router.delete('/:id', requireAuth, async (req, res) => {
	try {
		const { siteId, id } = req.params;
		const mock = req.app.locals.mockData;
		if (mock) {
			const before = mock.categories.length;
			mock.categories = mock.categories.filter((c) => !(c._id === id && c.site === siteId));
			if (mock.categories.length === before) return res.status(404).json({ error: 'Not found' });
			return res.status(204).end();
		}
		const result = await Category.findOneAndDelete({ _id: id, site: siteId });
		if (!result) return res.status(404).json({ error: 'Not found' });
		res.status(204).end();
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

export default router;

