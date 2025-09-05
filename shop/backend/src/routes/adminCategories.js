import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import Category from '../models/Category.js';

const router = Router({ mergeParams: true });

router.get('/', requireAuth, async (req, res) => {
	try {
		const { siteId } = req.params;
		const categories = await Category.find({ site: siteId }).sort({ sortIndex: 1, name: 1 });
		res.json(categories);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

router.post('/', requireAuth, async (req, res) => {
	try {
		const { siteId } = req.params;
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
		const result = await Category.findOneAndDelete({ _id: id, site: siteId });
		if (!result) return res.status(404).json({ error: 'Not found' });
		res.status(204).end();
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

export default router;

