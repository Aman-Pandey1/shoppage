import { Router } from 'express';
import Product from '../models/Product.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function normalizeOption(option, mode, contextKey, idx) {
  const fallbackKey = `${contextKey}_option_${idx}`;
  const key = String(option?.key || option?.label || fallbackKey).trim() || fallbackKey;
  const label = String(option?.label || option?.key || 'Option').trim();
  const description = option?.description ? String(option.description) : undefined;
  const priceDelta = mode === 'free' ? 0 : (Number(option?.priceDelta ?? option?.price) || 0);
  const childExtraOptionGroups = normalizeOptionGroups(option?.childExtraOptionGroups, 'extra', `${contextKey}::${key}`);
  const childFreeOptionGroups = normalizeOptionGroups(option?.childFreeOptionGroups, 'free', `${contextKey}::${key}`);
  return {
    key,
    label,
    priceDelta,
    description,
    isDefault: !!option?.isDefault,
    childExtraOptionGroups,
    childFreeOptionGroups,
  };
}

function normalizeOptionGroups(input, mode = 'extra', contextKey = 'root') {
  if (!Array.isArray(input)) return [];
  return input.map((group, idx) => {
    const fallbackKey = `${mode}_group_${idx}`;
    const groupKey = String(group?.groupKey || group?.groupLabel || fallbackKey).trim() || fallbackKey;
    const groupLabel = String(group?.groupLabel || groupKey || `Group ${idx + 1}`).trim();
    const helpText = group?.helpText ? String(group.helpText) : undefined;
    const rawOptions = Array.isArray(group?.options) ? group.options : [];
    const normalizedOptions = rawOptions
      .map((opt, optIdx) => normalizeOption(opt, mode, `${contextKey}::${groupKey}`, optIdx))
      .filter(Boolean);
    if (!normalizedOptions.length) return null;

    if (mode === 'free') {
      let defaultIndex = normalizedOptions.findIndex((opt) => opt.isDefault);
      if (defaultIndex < 0) defaultIndex = 0;
      const options = normalizedOptions.map((opt, optionIdx) => ({
        ...opt,
        priceDelta: 0,
        isDefault: optionIdx === defaultIndex,
      }));
      const isRequired = group?.isRequired === false ? false : true;
      return {
        groupKey,
        groupLabel,
        helpText,
        selectionType: 'single',
        isRequired,
        minSelect: isRequired ? 1 : 0,
        maxSelect: 1,
        options,
      };
    }

    const selectionType = group?.selectionType === 'multi' ? 'multi' : 'single';
    if (selectionType === 'single') {
      let defaultIndex = normalizedOptions.findIndex((opt) => opt.isDefault);
      if (defaultIndex < 0) defaultIndex = 0;
      const options = normalizedOptions.map((opt, optionIdx) => ({
        ...opt,
        isDefault: optionIdx === defaultIndex,
      }));
      let isRequired;
      if (typeof group?.isRequired === 'boolean') {
        isRequired = group.isRequired;
      } else {
        const minRaw = Number(group?.minSelect);
        isRequired = Number.isFinite(minRaw) ? minRaw >= 1 : defaultIndex >= 0;
      }
      return {
        groupKey,
        groupLabel,
        helpText,
        selectionType: 'single',
        isRequired,
        minSelect: isRequired ? 1 : 0,
        maxSelect: 1,
        options,
      };
    }

    const options = normalizedOptions.map((opt) => ({ ...opt, isDefault: !!opt.isDefault }));
    const minRaw = Number(group?.minSelect);
    const maxRaw = Number(group?.maxSelect);
    const minSelect = Number.isFinite(minRaw) ? Math.max(0, minRaw) : 0;
    const optionCount = options.length;
    let maxSelect = Number.isFinite(maxRaw) ? Math.max(minSelect, maxRaw) : (optionCount || minSelect);
    if (optionCount && maxSelect > optionCount) maxSelect = optionCount;
    const isRequired = typeof group?.isRequired === 'boolean' ? group.isRequired : minSelect > 0;
    return {
      groupKey,
      groupLabel,
      helpText,
      selectionType: 'multi',
      isRequired,
      minSelect: Math.min(minSelect, maxSelect),
      maxSelect: maxSelect || optionCount || 0,
      options,
    };
  }).filter(Boolean);
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
  obj.extraOptionGroups = normalizeOptionGroups(obj.extraOptionGroups, 'extra', 'product');
  obj.freeOptionGroups = normalizeOptionGroups(obj.freeOptionGroups, 'free', 'product');
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
