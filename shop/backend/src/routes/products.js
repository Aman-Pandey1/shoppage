import { Router } from 'express';
import Product from '../models/Product.js';

const router = Router();

router.get('/', async (req, res) => {
	const { categoryId } = req.query;
	const mock = req.app.locals.mockData;
	if (mock) {
		const list = mock.products.filter((p) => (categoryId ? p.categoryId === categoryId : true));
		return res.json(list);
	}
	const filter = categoryId ? { categoryId } : {};
	const products = await Product.find(filter).sort({ name: 1 });
	res.json(products);
});

router.post('/', async (req, res) => {
	try {
		const mock = req.app.locals.mockData;
		if (mock) {
			const newProd = { _id: `p-${Date.now()}`, ...req.body };
			mock.products.push(newProd);
			return res.status(201).json(newProd);
		}
		const product = await Product.create(req.body);
		res.status(201).json(product);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

export default router;
