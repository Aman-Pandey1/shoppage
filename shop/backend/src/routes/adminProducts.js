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

// Download Excel template
router.get('/template.xlsx', requireAdmin, async (_req, res) => {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([
    ['name','description','price','imageUrl','categoryName','spiceLevels'],
    ['Butter Chicken','Rich creamy gravy', '12.99','https://...','Mains','Mild,Medium,Hot']
  ]);
  xlsx.utils.book_append_sheet(wb, ws, 'Products');
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
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    const mock = req.app.locals.mockData;
    const created = [];
    for (const r of rows) {
      const name = r.name || r.Name;
      if (!name) continue;
      const price = parseFloat(String(r.price || r.Price || 0));
      const description = r.description || r.Description || '';
      const imageUrl = r.imageUrl || r.ImageUrl || '';
      const categoryName = r.categoryName || r.Category || '';
      const spiceLevels = String(r.spiceLevels || r.SpiceLevels || '').split(',').map((s) => String(s).trim()).filter(Boolean);

      // Resolve or create category by name
      let categoryId = null;
      if (mock) {
        let cat = (mock.categories || []).find((c) => c.site === siteId && String(c.name).toLowerCase() === String(categoryName).toLowerCase());
        if (!cat) {
          cat = { _id: `c-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, name: categoryName || 'Uncategorized', imageUrl: '', sortIndex: 0, site: siteId };
          mock.categories.unshift(cat);
        }
        categoryId = cat._id;
      } else {
        let cat = await Category.findOne({ site: siteId, name: categoryName });
        if (!cat) cat = await Category.create({ site: siteId, name: categoryName || 'Uncategorized', imageUrl: '', sortIndex: 0 });
        categoryId = cat._id;
      }

      const payload = { site: siteId, name, description, imageUrl, price, categoryId, spiceLevels, extraOptionGroups: [] };
      if (mock) {
        const p = { _id: `p-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, ...payload };
        mock.products.unshift(p);
        created.push(p);
      } else {
        const p = await Product.create(payload);
        created.push(p);
      }
    }
    try { if (req.app.locals.mockData) saveMockData(req.app.locals.mockData); } catch {}
    res.json({ created: created.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

