import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { saveMockData } from '../utils/mockStore.js';
import multer from 'multer';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';

const router = Router({ mergeParams: true });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // Allow reasonably large images; configurable via env (default 20MB)
    fileSize: Math.max(1, Number(process.env.MAX_UPLOAD_MB || process.env.MAX_IMAGE_UPLOAD_MB || 20)) * 1024 * 1024,
  },
});

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

// Delete ALL categories for a site
router.delete('/', requireAdmin, async (req, res) => {
  try {
    const { siteId } = req.params;
    const mock = req.app.locals.mockData;
    if (mock) {
      const before = (mock.categories || []).length;
      mock.categories = (mock.categories || []).filter((c) => c.site !== siteId);
      const deleted = before - mock.categories.length;
      try { saveMockData(req.app.locals.mockData); } catch {}
      return res.json({ deleted });
    }
    const result = await Category.deleteMany({ site: siteId });
    return res.json({ deleted: result?.deletedCount || 0 });
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
// Upload a category image and set imageUrl
// Accept common field names and validate file type for robustness
router.post('/:id/image', requireAdmin, upload.any(), async (req, res) => {
  try {
    const { siteId, id } = req.params;
    const incomingFile = req.file || (Array.isArray(req.files) ? req.files.find((f) => f.fieldname === 'file' || f.fieldname === 'image' || f.fieldname === 'logo') : null);
    if (!incomingFile) return res.status(400).json({ error: 'Missing file' });
    // Only allow image uploads
    if (!(incomingFile.mimetype && /^image\//.test(incomingFile.mimetype))) {
      return res.status(400).json({ error: 'Invalid file type. Please upload an image.' });
    }
    // Decide storage: inline data URL in DB (default) or filesystem path. Inline avoids
    // ephemeral FS issues on platforms like Render where files can disappear on redeploy.
    const STORE_IN_DB = String(process.env.STORE_CATEGORY_IMAGE_IN_DB || process.env.STORE_IMAGES_IN_DB || 'true').toLowerCase() === 'true';
    let storedUrl = '';
    if (STORE_IN_DB) {
      const mime = incomingFile.mimetype || 'image/png';
      const base64 = incomingFile.buffer.toString('base64');
      storedUrl = `data:${mime};base64,${base64}`;
    } else {
      const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
      try { await mkdir(dir, { recursive: true }); } catch {}
      const ext = path.extname(incomingFile.originalname || '') || '.png';
      const fileName = `cat-${siteId}-${id}-${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
      const filePath = path.join(dir, fileName);
      await writeFile(filePath, incomingFile.buffer);
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

// Merge categories: move all products from `from` to `to` within the same site
// Body supports either IDs or names: { fromId, toId } or { fromName, toName }
// Optional: { keepFrom: boolean } to retain the source category
router.post('/merge', requireAdmin, async (req, res) => {
  try {
    const { siteId } = req.params;
    const { fromId, toId, fromName, toName, keepFrom } = req.body || {};
    const mock = req.app.locals.mockData;

    if (mock) {
      const categories = (req.app.locals.mockData.categories || []).filter((c) => c.site === siteId);
      const findBy = (id, name) => {
        if (id) return categories.find((c) => c._id === id);
        if (name) {
          let c = categories.find((x) => String(x.name) === String(name));
          if (!c) c = categories.find((x) => String(x.name).toLowerCase() === String(name).toLowerCase());
          if (!c) {
            const simplified = String(name).replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
            c = categories.find((x) => String(x.name).toLowerCase().startsWith(simplified));
          }
          return c;
        }
        return null;
      };
      const fromCat = findBy(fromId, fromName);
      const toCat = findBy(toId, toName);
      if (!fromCat || !toCat) return res.status(404).json({ error: 'Category not found' });
      let moved = 0;
      for (let i = 0; i < req.app.locals.mockData.products.length; i++) {
        const p = req.app.locals.mockData.products[i];
        if (p.site === siteId && p.categoryId === fromCat._id) {
          req.app.locals.mockData.products[i] = { ...p, categoryId: toCat._id };
          moved += 1;
        }
      }
      if (!keepFrom) {
        req.app.locals.mockData.categories = req.app.locals.mockData.categories.filter((c) => !(c.site === siteId && c._id === fromCat._id));
      }
      try { saveMockData(req.app.locals.mockData); } catch {}
      return res.json({ ok: true, movedProducts: moved, fromDeleted: !keepFrom });
    }

    const findCategory = async (id, name) => {
      if (id) return await Category.findOne({ _id: id, site: siteId });
      if (name) {
        let c = await Category.findOne({ site: siteId, name: name });
        if (!c) c = await Category.findOne({ site: siteId, name: new RegExp(`^${name}$`, 'i') });
        if (!c) {
          const simplified = String(name).replace(/\s*\(.*?\)\s*/g, '').trim();
          c = await Category.findOne({ site: siteId, name: new RegExp(`^${simplified}`, 'i') });
        }
        return c;
      }
      return null;
    };

    const fromCat = await findCategory(fromId, fromName);
    const toCat = await findCategory(toId, toName);
    if (!fromCat || !toCat) return res.status(404).json({ error: 'Category not found' });

    const moved = await Product.updateMany({ site: siteId, categoryId: fromCat._id }, { $set: { categoryId: toCat._id } });
    let deleted = false;
    if (!keepFrom) {
      const del = await Category.findOneAndDelete({ _id: fromCat._id, site: siteId });
      deleted = !!del;
    }
    return res.json({ ok: true, movedProducts: moved.modifiedCount || 0, fromDeleted: deleted });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

