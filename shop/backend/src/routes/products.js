import { Router } from 'express';
import Product from '../models/Product.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function sanitizeFreeOptionGroups(input) {
  if (!Array.isArray(input)) return [];
  return input.map((group, idx) => {
    const groupKey = String(group?.groupKey || group?.groupLabel || `free_group_${idx}`).trim();
    const groupLabel = String(group?.groupLabel || groupKey || `Free option ${idx + 1}`).trim();
    const helpText = group?.helpText ? String(group.helpText) : undefined;
    const rawOptions = Array.isArray(group?.options) ? group.options : [];
    const normalizedOptions = rawOptions.map((opt, optIdx) => {
      const key = String(opt?.key || opt?.label || `${groupKey}_opt_${optIdx}`).trim();
      const label = String(opt?.label || opt?.key || 'Option').trim();
      const description = opt?.description ? String(opt.description) : undefined;
      const isDefault = !!opt?.isDefault;
      return { key, label, description, isDefault, priceDelta: 0 };
    });
    if (!normalizedOptions.length) return null;
    let defaultIndex = normalizedOptions.findIndex((opt) => opt.isDefault);
    if (defaultIndex < 0) defaultIndex = 0;
    const options = normalizedOptions.map((opt, idxOpt) => ({
      key: opt.key,
      label: opt.label,
      description: opt.description,
      isDefault: idxOpt === defaultIndex,
      priceDelta: 0,
    }));
    const isRequired = group?.isRequired === false ? false : true;
    return { groupKey, groupLabel, helpText, isRequired, options };
  }).filter(Boolean);
}

function normalizeFreeOptionGroups(input) {
  const groups = sanitizeFreeOptionGroups(input);
  return groups.map((group) => ({
    ...group,
    selectionType: 'single',
    minSelect: group.isRequired === false ? 0 : 1,
    maxSelect: 1,
  }));
}

// Ensure variants[] always exposes a `price` number for UI
function normalizeProductShape(p) {
  if (!p) return p;
  const obj = (typeof p.toObject === 'function') ? p.toObject() : { ...p };
  if (Array.isArray(obj.variants)) {
    obj.variants = obj.variants.map((v) => ({
      key: String(v?.key || v?.label || 'variant').trim(),
      label: String(v?.label || v?.key || 'Variant').trim(),
      price: Number((v?.price ?? v?.priceDelta) || 0) || 0,
    }));
  }
  if (Array.isArray(obj.extraOptionGroups)) {
    obj.extraOptionGroups = obj.extraOptionGroups.map((group, idx) => {
      const selectionType = (group?.selectionType === 'single') ? 'single' : 'multi';
      const options = Array.isArray(group?.options)
        ? group.options.map((opt) => ({
            key: String(opt?.key || opt?.label || `option_${idx}`).trim(),
            label: String(opt?.label || opt?.key || 'Option').trim(),
            priceDelta: Number((opt?.priceDelta ?? opt?.price) || 0) || 0,
            description: opt?.description ? String(opt.description) : undefined,
            isDefault: !!opt?.isDefault,
          }))
        : [];
      const normalizedMin = Number.isFinite(Number(group?.minSelect)) ? Number(group.minSelect) : 0;
      const normalizedMax = Number.isFinite(Number(group?.maxSelect)) ? Number(group.maxSelect) : 0;
      let isRequired;
      if (selectionType === 'single') {
        if (typeof group?.isRequired === 'boolean') {
          isRequired = group.isRequired;
        } else {
          const hasDefault = options.some((opt) => opt.isDefault);
          isRequired = normalizedMin >= 1 || hasDefault;
        }
      } else {
        isRequired = typeof group?.isRequired === 'boolean'
          ? group.isRequired
          : normalizedMin > 0;
      }
      const resolvedMin = selectionType === 'single' ? 1 : Math.max(0, normalizedMin);
      const resolvedMax = selectionType === 'single'
        ? 1
        : Math.max(0, normalizedMax || (options.length ? options.length : 0));
      return {
        groupKey: String(group?.groupKey || group?.groupLabel || `group_${idx}`).trim(),
        groupLabel: String(group?.groupLabel || group?.groupKey || `Group ${idx + 1}`).trim(),
        helpText: group?.helpText ? String(group.helpText) : undefined,
        selectionType,
        isRequired,
        minSelect: resolvedMin,
        maxSelect: Math.max(resolvedMin, resolvedMax),
        options,
      };
    });
  }
  obj.freeOptionGroups = normalizeFreeOptionGroups(obj.freeOptionGroups);
  return obj;
}

router.get('/', async (req, res) => {
	const { categoryId } = req.query;
	const mock = req.app.locals.mockData;
	if (mock) {
    const list = mock.products.filter((p) => (categoryId ? p.categoryId === categoryId : true));
    return res.json(list.map(normalizeProductShape));
	}
	const filter = categoryId ? { categoryId } : {};
  const products = await Product.find(filter)
    .select('name description imageUrl price categoryId isVeg spiceLevels variants extraOptionGroups freeOptionGroups')
    .sort({ name: 1 });
  res.json(products.map(normalizeProductShape));
});

router.post('/', requireAuth, async (req, res) => {
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

router.put('/:id', requireAuth, async (req, res) => {
	try {
		const { id } = req.params;
		const mock = req.app.locals.mockData;
		if (mock) {
			const idx = mock.products.findIndex((p) => p._id === id);
			if (idx === -1) return res.status(404).json({ error: 'Not found' });
			const updated = { ...mock.products[idx], ...req.body, _id: id };
			mock.products[idx] = updated;
			return res.json(updated);
		}
    const update = { ...req.body };
    if ('site' in update) delete update.site;
    const product = await Product.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true, overwrite: false }
    );
		if (!product) return res.status(404).json({ error: 'Not found' });
		res.json(product);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

router.delete('/:id', requireAuth, async (req, res) => {
	try {
		const { id } = req.params;
		const mock = req.app.locals.mockData;
		if (mock) {
			const before = mock.products.length;
			mock.products = mock.products.filter((p) => p._id !== id);
			if (mock.products.length === before) return res.status(404).json({ error: 'Not found' });
			return res.status(204).end();
		}
		const result = await Product.findByIdAndDelete(id);
		if (!result) return res.status(404).json({ error: 'Not found' });
		res.status(204).end();
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

export default router;
