import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { saveMockData } from '../utils/mockStore.js';
import multer from 'multer';
import xlsx from 'xlsx';

const router = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', requireAdmin, async (req, res) => {
	try {
		const { siteId } = req.params;
		const { categoryId, veg, isVeg } = req.query;
		const mock = req.app.locals.mockData;
		if (mock) {
			let list = mock.products.filter((p) => p.site === siteId);
			if (categoryId) list = list.filter((p) => String(p.categoryId) === String(categoryId));
			let vegFilter = null;
			if (typeof veg === 'string') {
				if (veg.toLowerCase() === 'veg') vegFilter = true;
				if (veg.toLowerCase() === 'nonveg') vegFilter = false;
			}
			if (typeof isVeg === 'string') {
				if (isVeg.toLowerCase() === 'true') vegFilter = true;
				if (isVeg.toLowerCase() === 'false') vegFilter = false;
			}
			if (vegFilter !== null) list = list.filter((p) => (typeof p.isVeg === 'boolean' ? p.isVeg : true) === vegFilter);
			list.sort((a, b) => a.name.localeCompare(b.name));
			return res.json(list);
		}
		const filter = { site: siteId };
		if (categoryId) filter.categoryId = categoryId;
		if (typeof veg === 'string') {
			if (veg.toLowerCase() === 'veg') filter.isVeg = true;
			if (veg.toLowerCase() === 'nonveg') filter.isVeg = false;
		}
		if (typeof isVeg === 'string') {
			if (isVeg.toLowerCase() === 'true') filter.isVeg = true;
			if (isVeg.toLowerCase() === 'false') filter.isVeg = false;
		}
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

// Download Excel template
router.get('/template.xlsx', requireAdmin, async (_req, res) => {
	const wb = xlsx.utils.book_new();
	// Categories sheet
	const categoriesWs = xlsx.utils.aoa_to_sheet([
		['name','imageUrl'],
		['Mains','https://example.com/mains.jpg']
	]);
	xlsx.utils.book_append_sheet(wb, categoriesWs, 'Categories');
	// Products sheet
	const productsWs = xlsx.utils.aoa_to_sheet([
		['name','description','price','spiceLevels','categoryName'],
		['Butter Chicken','Rich creamy gravy','12.99','Mild,Medium,Hot','Mains']
	]);
	xlsx.utils.book_append_sheet(wb, productsWs, 'Products');
	const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
	res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
	res.setHeader('Content-Disposition', 'attachment; filename="product_template.xlsx"');
	res.send(buf);
});

// Bulk upload via Excel
router.post('/bulk', requireAdmin, upload.single('file'), async (req, res) => {
	try {
		const { siteId } = req.params;
		if (!req.file) return res.status(400).json({ error: 'Missing file' });
		const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
		const mock = req.app.locals.mockData;

		const createdProducts = [];
		let createdCategories = 0;

		// Helper to ensure a category exists and return its id
    async function ensureCategoryByName(categoryNameInput, imageUrlInput = '') {
			const categoryName = String(categoryNameInput || '').trim() || 'Uncategorized';
			let categoryId = null;
			if (mock) {
				let cat = (mock.categories || []).find((c) => c.site === siteId && String(c.name).toLowerCase() === categoryName.toLowerCase());
				if (!cat) {
          const fallbackImage = imageUrlInput || `https://picsum.photos/seed/${encodeURIComponent(categoryName.toLowerCase())}/400/400`;
          cat = { _id: `c-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, name: categoryName, imageUrl: fallbackImage, sortIndex: 0, site: siteId };
					mock.categories.unshift(cat);
					createdCategories += 1;
				} else if (imageUrlInput && !cat.imageUrl) {
					// Fill imageUrl if it's missing
					cat.imageUrl = imageUrlInput;
				}
				categoryId = cat._id;
			} else {
				let cat = await Category.findOne({ site: siteId, name: categoryName });
				if (!cat) {
          const fallbackImage = imageUrlInput || `https://picsum.photos/seed/${encodeURIComponent(categoryName.toLowerCase())}/400/400`;
          cat = await Category.create({ site: siteId, name: categoryName, imageUrl: fallbackImage, sortIndex: 0 });
					createdCategories += 1;
				} else if (imageUrlInput && !cat.imageUrl) {
					cat.imageUrl = imageUrlInput;
					await cat.save();
				}
				categoryId = cat._id;
			}
			return categoryId;
		}

		// 1) Import Categories sheet if present
		if (wb.SheetNames.includes('Categories')) {
			const catSheet = wb.Sheets['Categories'];
			const catRows = xlsx.utils.sheet_to_json(catSheet, { defval: '' });
			for (const r of catRows) {
				const name = r.name || r.Name;
				if (!name) continue;
				const imageUrl = r.imageUrl || r.ImageUrl || r['image url'] || r.Image || '';
				// ensure creates or updates image if missing
				await ensureCategoryByName(name, imageUrl);
			}
		}

		// 2) Import Products sheet (or fallback to first sheet for backward compat)
		let productSheetName = 'Products';
		if (!wb.SheetNames.includes(productSheetName)) productSheetName = wb.SheetNames[0];
		const sheet = wb.Sheets[productSheetName];
		const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
		for (const r of rows) {
			const name = r.name || r.Name || r['product name'] || r.Product;
			if (!name) continue;
			const price = parseFloat(String(r.price || r.Price || 0));
			if (Number.isNaN(price)) continue;
			const description = r.description || r.Description || '';
			const spiceLevels = String(r.spiceLevels || r['spice level'] || r.SpiceLevels || '').split(',').map((s) => String(s).trim()).filter(Boolean);
			const categoryName = r.categoryName || r.CategoryName || r.Category || '';
			const imageUrl = r.imageUrl || r.ImageUrl || '';
			const isVegCell = r.isVeg ?? r.IsVeg ?? r.veg ?? r.Veg;
			const isVeg = typeof isVegCell === 'string' ? /^(1|true|yes|veg)$/i.test(isVegCell) : (typeof isVegCell === 'boolean' ? isVegCell : true);

			const categoryId = await ensureCategoryByName(categoryName);
			const payload = { site: siteId, name, description, imageUrl, price, categoryId, spiceLevels, isVeg, extraOptionGroups: [] };
			if (mock) {
				const p = { _id: `p-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, ...payload };
				mock.products.unshift(p);
				createdProducts.push(p);
			} else {
				const p = await Product.create(payload);
				createdProducts.push(p);
			}
		}

		try { if (req.app.locals.mockData) saveMockData(req.app.locals.mockData); } catch {}
		res.json({ created: createdProducts.length, createdProducts: createdProducts.length, createdCategories });
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

export default router;

