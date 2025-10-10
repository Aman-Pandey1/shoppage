import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import Category from '../models/Category.js';
import { saveMockData } from '../utils/mockStore.js';
import multer from 'multer';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';

const router = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', requireAdmin, async (req, res) => {
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

router.post('/', requireAdmin, async (req, res) => {
    try {
        const { siteId } = req.params;
        const mock = req.app.locals.mockData;
        const body = { ...req.body };
        // Provide a stable fallback image if none provided
        const categoryName = String(body.name || '').trim() || 'Uncategorized';
        const fallbackImage = body.imageUrl && String(body.imageUrl).trim()
          ? String(body.imageUrl).trim()
          : `https://picsum.photos/seed/${encodeURIComponent(categoryName.toLowerCase())}/400/400`;

        if (mock) {
            const created = { _id: `c-${Date.now()}`,
                name: categoryName,
                imageUrl: fallbackImage,
                sortIndex: Number(body.sortIndex) || 0,
                site: siteId };
            mock.categories.unshift(created);
            try { saveMockData(req.app.locals.mockData); } catch {}
            return res.status(201).json(created);
        }
        const payload = { site: siteId, name: categoryName, imageUrl: fallbackImage, sortIndex: Number(body.sortIndex) || 0 };
        const created = await Category.create(payload);
        res.status(201).json(created);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.patch('/:id', requireAdmin, async (req, res) => {
    try {
        const { siteId, id } = req.params;
        const mock = req.app.locals.mockData;
        // Avoid unintentionally clearing imageUrl to an empty string
        const incoming = { ...req.body };
        if (typeof incoming.imageUrl === 'string' && incoming.imageUrl.trim() === '') {
            delete incoming.imageUrl;
        }
        if (mock) {
            const idx = mock.categories.findIndex((c) => c._id === id && c.site === siteId);
            if (idx === -1) return res.status(404).json({ error: 'Not found' });
            const updated = { ...mock.categories[idx], ...incoming };
            mock.categories[idx] = updated;
            try { saveMockData(req.app.locals.mockData); } catch {}
            return res.json(updated);
        }
        const updated = await Category.findOneAndUpdate({ _id: id, site: siteId }, incoming, { new: true });
        if (!updated) return res.status(404).json({ error: 'Not found' });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/:id', requireAdmin, async (req, res) => {
	try {
		const { siteId, id } = req.params;
		const mock = req.app.locals.mockData;
		if (mock) {
			const before = mock.categories.length;
			mock.categories = mock.categories.filter((c) => !(c._id === id && c.site === siteId));
			if (mock.categories.length === before) return res.status(404).json({ error: 'Not found' });
			try { saveMockData(req.app.locals.mockData); } catch {}
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

// Upload a category image and set imageUrl
router.post('/:id/image', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    const { siteId, id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'Missing file' });

    // Store images inline as data URLs so they persist across restarts
    const mime = req.file.mimetype && /^image\//.test(req.file.mimetype) ? req.file.mimetype : 'image/png';
    const base64 = req.file.buffer.toString('base64');
    const dataUrl = `data:${mime};base64,${base64}`;

    const mock = req.app.locals.mockData;
    if (mock) {
      const idx = mock.categories.findIndex((c) => c._id === id && c.site === siteId);
      if (idx === -1) return res.status(404).json({ error: 'Not found' });
      mock.categories[idx].imageUrl = dataUrl;
      try { saveMockData(req.app.locals.mockData); } catch {}
      return res.json({ ok: true, imageUrl: dataUrl, category: mock.categories[idx] });
    }
    const updated = await Category.findOneAndUpdate({ _id: id, site: siteId }, { imageUrl: dataUrl }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, imageUrl: dataUrl, category: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

