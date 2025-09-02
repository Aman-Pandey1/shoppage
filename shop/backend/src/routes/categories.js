import { Router } from 'express';
import Category from '../models/Category.js';

const router = Router();

router.get('/', async (req, res) => {
	const mock = req.app.locals.mockData;
	if (mock) {
		return res.json(mock.categories);
	}
	const categories = await Category.find({}).sort({ sortIndex: 1, name: 1 });
	res.json(categories);
});

router.post('/', async (req, res) => {
	try {
		const mock = req.app.locals.mockData;
		if (mock) {
			const newCat = { _id: `c-${Date.now()}`, ...req.body };
			mock.categories.push(newCat);
			return res.status(201).json(newCat);
		}
		const category = await Category.create(req.body);
		res.status(201).json(category);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

export default router;
