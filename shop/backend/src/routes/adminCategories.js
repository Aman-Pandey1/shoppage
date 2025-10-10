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
    const name = String(req.body?.name || '').trim();
    const providedImage = String(req.body?.imageUrl || '').trim();
    const imageUrl = providedImage || `https://picsum.photos/seed/${encodeURIComponent((name || 'category').toLowerCase())}/400/400`;
    const sortIndex = Number(req.body?.sortIndex) || 0;
    const mock = req.app.locals.mockData;
    if (mock) {
      const created = { _id: `c-${Date.now()}`, name, imageUrl, sortIndex, site: siteId };
      mock.categories.unshift(created);
      try { saveMockData(req.app.locals.mockData); } catch {}
      return res.status(201).json(created);
    }
    const payload = { site: siteId, name, imageUrl, sortIndex };
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
        if (mock) {
            const idx = mock.categories.findIndex((c) => c._id === id && c.site === siteId);
            if (idx === -1) return res.status(404).json({ error: 'Not found' });
            const incoming = { ...req.body };
            // Prevent wiping imageUrl when an empty string is sent from UI
            if (!(typeof incoming.imageUrl === 'string' && incoming.imageUrl.trim().length > 0)) {
              delete incoming.imageUrl;
            }
            const updated = { ...mock.categories[idx], ...incoming };
            mock.categories[idx] = updated;
            try { saveMockData(req.app.locals.mockData); } catch {}
            return res.json(updated);
        }
        const incoming = { ...req.body };
        if (incoming.imageUrl !== undefined && !String(incoming.imageUrl || '').trim()) {
          delete incoming.imageUrl;
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
    // Decide storage: inline data URL in DB (default) or filesystem path
    const STORE_IN_DB = String(process.env.STORE_CATEGORY_IMAGE_IN_DB || process.env.STORE_IMAGES_IN_DB || 'true').toLowerCase() === 'true';
    let storedUrl = '';
    if (STORE_IN_DB) {
      const mime = (req.file.mimetype && /^image\//.test(req.file.mimetype)) ? req.file.mimetype : 'image/png';
      const base64 = req.file.buffer.toString('base64');
      storedUrl = `data:${mime};base64,${base64}`;
    } else {
      const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
      try { await mkdir(dir, { recursive: true }); } catch {}
      const ext = path.extname(req.file.originalname || '') || '.png';
      const fileName = `cat-${siteId}-${id}-${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
      const filePath = path.join(dir, fileName);
      await writeFile(filePath, req.file.buffer);
      storedUrl = `/uploads/${fileName}`;
    }

    const mock = req.app.locals.mockData;
    if (mock) {
      const idx = mock.categories.findIndex((c) => c._id === id && c.site === siteId);
      if (idx === -1) return res.status(404).json({ error: 'Not found' });
      mock.categories[idx].imageUrl = storedUrl;
      try { saveMockData(req.app.locals.mockData); } catch {}
      return res.json({ ok: true, imageUrl: storedUrl, category: mock.categories[idx] });
    }
    const updated = await Category.findOneAndUpdate({ _id: id, site: siteId }, { imageUrl: storedUrl }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, imageUrl: storedUrl, category: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

