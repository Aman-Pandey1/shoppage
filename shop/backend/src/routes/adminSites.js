import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import Site from '../models/Site.js';
import { saveMockData } from '../utils/mockStore.js';
import Order from '../models/Order.js';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', requireAdmin, async (_req, res) => {
	try {
		const mock = _req.app.locals.mockData;
		if (mock) {
			return res.json([...mock.sites]);
		}
		const sites = await Site.find({}).sort({ createdAt: -1 });
		res.json(sites);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

router.post('/', requireAdmin, async (req, res) => {
	try {
    const { name, slug, domains, uberCustomerId, pickup, brandColor, headerColor, locations, cities, hours, deliveryFeeCents, splitDeliveryFee, logoUrl, bannerImageUrl, logoLinkUrl, stripeAccountId, deliveryProvider, doordashStoreId, tagline, stripePublishableKey, stripeSecretKey, uberClientId, uberClientSecret, uberEnv, uberTokenScopes, doordashDeveloperId, doordashKeyId, doordashSigningSecret, uberWebhookSecret, stripeWebhookSecret, maxDeliveryDistanceKm, currency, minOrderCents, couponMinSubtotalCents, orderNotifyUrl, timeZone, supportWhatsappPhone, freeDeliveryEnabled, freeDeliveryMinSubtotalCents } = req.body || {};
		if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });
		const mock = req.app.locals.mockData;
    if (mock) {
      const created = { _id: `site-${Date.now()}`, name, slug, domains: domains || [], uberCustomerId, uberClientId, uberClientSecret, uberEnv, uberTokenScopes, uberWebhookSecret, deliveryProvider: deliveryProvider === 'doordash' ? 'doordash' : 'uber', doordashStoreId, doordashDeveloperId, doordashKeyId, doordashSigningSecret, pickup, locations: Array.isArray(locations) ? locations : [], cities: Array.isArray(cities) ? cities : [], hours: hours || undefined, timeZone: timeZone || undefined, deliveryFeeCents: Number(deliveryFeeCents) || 0, splitDeliveryFee: !!splitDeliveryFee, freeDeliveryEnabled: !!freeDeliveryEnabled, freeDeliveryMinSubtotalCents: typeof freeDeliveryMinSubtotalCents === 'number' ? Number(freeDeliveryMinSubtotalCents) : undefined, brandColor: brandColor || '#0ea5e9', headerColor, logoUrl, bannerImageUrl, logoLinkUrl, tagline, isActive: true, stripeAccountId, stripePublishableKey, stripeSecretKey, stripeWebhookSecret, currency: (currency || 'usd').toLowerCase(), minOrderCents: typeof minOrderCents === 'number' ? Number(minOrderCents) : undefined, couponMinSubtotalCents: typeof couponMinSubtotalCents === 'number' ? Number(couponMinSubtotalCents) : undefined, orderNotifyUrl, supportWhatsappPhone };
			mock.sites.unshift(created);
			try { saveMockData(req.app.locals.mockData); } catch {}
			return res.status(201).json(created);
		}
    const site = await Site.create({ name, slug, domains: domains || [], uberCustomerId, uberClientId, uberClientSecret, uberEnv, uberTokenScopes, uberWebhookSecret, deliveryProvider: deliveryProvider === 'doordash' ? 'doordash' : 'uber', doordashStoreId, doordashDeveloperId, doordashKeyId, doordashSigningSecret, pickup, locations: Array.isArray(locations) ? locations : [], cities: Array.isArray(cities) ? cities : [], hours, timeZone: timeZone || undefined, deliveryFeeCents: Number(deliveryFeeCents) || 0, splitDeliveryFee: !!splitDeliveryFee, freeDeliveryEnabled: !!freeDeliveryEnabled, freeDeliveryMinSubtotalCents: typeof freeDeliveryMinSubtotalCents === 'number' ? Number(freeDeliveryMinSubtotalCents) : undefined, brandColor: brandColor || '#0ea5e9', headerColor, logoUrl, bannerImageUrl, logoLinkUrl, tagline, stripeAccountId, stripePublishableKey, stripeSecretKey, stripeWebhookSecret, maxDeliveryDistanceKm: typeof maxDeliveryDistanceKm === 'number' ? maxDeliveryDistanceKm : undefined, currency: (currency || 'usd').toLowerCase(), minOrderCents: typeof minOrderCents === 'number' ? Number(minOrderCents) : undefined, couponMinSubtotalCents: typeof couponMinSubtotalCents === 'number' ? Number(couponMinSubtotalCents) : undefined, orderNotifyUrl, supportWhatsappPhone, isActive: true });
		res.status(201).json(site);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

router.patch('/:siteId', requireAdmin, async (req, res) => {
	try {
		const { siteId } = req.params;
    const { name, slug, domains, isActive, uberCustomerId, pickup, brandColor, headerColor, locations, cities, hours, deliveryFeeCents, splitDeliveryFee, logoUrl, bannerImageUrl, logoLinkUrl, stripeAccountId, deliveryProvider, doordashStoreId, tagline, stripePublishableKey, stripeSecretKey, uberClientId, uberClientSecret, uberEnv, uberTokenScopes, doordashDeveloperId, doordashKeyId, doordashSigningSecret, uberWebhookSecret, stripeWebhookSecret, maxDeliveryDistanceKm, currency, minOrderCents, couponMinSubtotalCents, orderNotifyUrl, timeZone, supportWhatsappPhone, freeDeliveryEnabled, freeDeliveryMinSubtotalCents } = req.body || {};
		const mock = req.app.locals.mockData;
    if (mock) {
			const idx = mock.sites.findIndex((s) => s._id === siteId);
			if (idx === -1) return res.status(404).json({ error: 'Not found' });
      const updated = { ...mock.sites[idx], ...(name !== undefined ? { name } : {}), ...(slug !== undefined ? { slug } : {}), ...(domains !== undefined ? { domains } : {}), ...(isActive !== undefined ? { isActive } : {}), ...(uberCustomerId !== undefined ? { uberCustomerId } : {}), ...(uberClientId !== undefined ? { uberClientId } : {}), ...(uberClientSecret !== undefined ? { uberClientSecret } : {}), ...(uberEnv !== undefined ? { uberEnv } : {}), ...(uberTokenScopes !== undefined ? { uberTokenScopes } : {}), ...(uberWebhookSecret !== undefined ? { uberWebhookSecret } : {}), ...(deliveryProvider !== undefined ? { deliveryProvider: deliveryProvider === 'doordash' ? 'doordash' : 'uber' } : {}), ...(doordashStoreId !== undefined ? { doordashStoreId } : {}), ...(doordashDeveloperId !== undefined ? { doordashDeveloperId } : {}), ...(doordashKeyId !== undefined ? { doordashKeyId } : {}), ...(doordashSigningSecret !== undefined ? { doordashSigningSecret } : {}), ...(pickup !== undefined ? { pickup } : {}), ...(brandColor !== undefined ? { brandColor } : {}), ...(headerColor !== undefined ? { headerColor } : {}), ...(locations !== undefined ? { locations } : {}), ...(cities !== undefined ? { cities } : {}), ...(hours !== undefined ? { hours } : {}), ...(timeZone !== undefined ? { timeZone } : {}), ...(deliveryFeeCents !== undefined ? { deliveryFeeCents: Number(deliveryFeeCents) || 0 } : {}), ...(splitDeliveryFee !== undefined ? { splitDeliveryFee: !!splitDeliveryFee } : {}), ...(freeDeliveryEnabled !== undefined ? { freeDeliveryEnabled: !!freeDeliveryEnabled } : {}), ...(freeDeliveryMinSubtotalCents !== undefined ? { freeDeliveryMinSubtotalCents: Number(freeDeliveryMinSubtotalCents) } : {}), ...(maxDeliveryDistanceKm !== undefined ? { maxDeliveryDistanceKm: Number(maxDeliveryDistanceKm) } : {}), ...(logoUrl !== undefined ? { logoUrl } : {}), ...(bannerImageUrl !== undefined ? { bannerImageUrl } : {}), ...(logoLinkUrl !== undefined ? { logoLinkUrl } : {}), ...(stripeAccountId !== undefined ? { stripeAccountId } : {}), ...(stripePublishableKey !== undefined ? { stripePublishableKey } : {}), ...(stripeSecretKey !== undefined ? { stripeSecretKey } : {}), ...(stripeWebhookSecret !== undefined ? { stripeWebhookSecret } : {}), ...(tagline !== undefined ? { tagline } : {}), ...(currency !== undefined ? { currency: String(currency).toLowerCase() } : {}), ...(minOrderCents !== undefined ? { minOrderCents: Number(minOrderCents) } : {}), ...(couponMinSubtotalCents !== undefined ? { couponMinSubtotalCents: Number(couponMinSubtotalCents) } : {}), ...(orderNotifyUrl !== undefined ? { orderNotifyUrl } : {}), ...(supportWhatsappPhone !== undefined ? { supportWhatsappPhone } : {}) };
			mock.sites[idx] = updated;
			try { saveMockData(req.app.locals.mockData); } catch {}
			return res.json(updated);
		}
    // Build updates object only with provided fields so partial PATCH doesn't unset others
    const updates = {
      ...(name !== undefined ? { name } : {}),
      ...(slug !== undefined ? { slug } : {}),
      ...(domains !== undefined ? { domains } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(uberCustomerId !== undefined ? { uberCustomerId } : {}),
      ...(uberClientId !== undefined ? { uberClientId } : {}),
      ...(uberClientSecret !== undefined ? { uberClientSecret } : {}),
      ...(uberEnv !== undefined ? { uberEnv } : {}),
      ...(uberTokenScopes !== undefined ? { uberTokenScopes } : {}),
      ...(uberWebhookSecret !== undefined ? { uberWebhookSecret } : {}),
      ...(deliveryProvider !== undefined ? { deliveryProvider: deliveryProvider === 'doordash' ? 'doordash' : 'uber' } : {}),
      ...(doordashStoreId !== undefined ? { doordashStoreId } : {}),
      ...(doordashDeveloperId !== undefined ? { doordashDeveloperId } : {}),
      ...(doordashKeyId !== undefined ? { doordashKeyId } : {}),
      ...(doordashSigningSecret !== undefined ? { doordashSigningSecret } : {}),
      ...(pickup !== undefined ? { pickup } : {}),
      ...(brandColor !== undefined ? { brandColor } : {}),
      ...(locations !== undefined ? { locations } : {}),
      ...(cities !== undefined ? { cities } : {}),
      ...(hours !== undefined ? { hours } : {}),
      ...(timeZone !== undefined ? { timeZone } : {}),
      ...(deliveryFeeCents !== undefined ? { deliveryFeeCents: Number(deliveryFeeCents) || 0 } : {}),
      ...(splitDeliveryFee !== undefined ? { splitDeliveryFee: !!splitDeliveryFee } : {}),
      ...(freeDeliveryEnabled !== undefined ? { freeDeliveryEnabled: !!freeDeliveryEnabled } : {}),
      ...(freeDeliveryMinSubtotalCents !== undefined ? { freeDeliveryMinSubtotalCents: Number(freeDeliveryMinSubtotalCents) } : {}),
      ...(maxDeliveryDistanceKm !== undefined ? { maxDeliveryDistanceKm: Number(maxDeliveryDistanceKm) } : {}),
      ...(logoUrl !== undefined ? { logoUrl } : {}),
      ...(bannerImageUrl !== undefined ? { bannerImageUrl } : {}),
      ...(logoLinkUrl !== undefined ? { logoLinkUrl } : {}),
      ...(tagline !== undefined ? { tagline } : {}),
      ...(stripeAccountId !== undefined ? { stripeAccountId } : {}),
      ...(stripePublishableKey !== undefined ? { stripePublishableKey } : {}),
      ...(stripeSecretKey !== undefined ? { stripeSecretKey } : {}),
      ...(stripeWebhookSecret !== undefined ? { stripeWebhookSecret } : {}),
      ...(currency !== undefined ? { currency: String(currency).toLowerCase() } : {}),
      ...(minOrderCents !== undefined ? { minOrderCents: Number(minOrderCents) } : {}),
      ...(couponMinSubtotalCents !== undefined ? { couponMinSubtotalCents: Number(couponMinSubtotalCents) } : {}),
      ...(orderNotifyUrl !== undefined ? { orderNotifyUrl } : {}),
      ...(supportWhatsappPhone !== undefined ? { supportWhatsappPhone } : {}),
      ...(headerColor !== undefined ? { headerColor } : {}),
    };
    const site = await Site.findByIdAndUpdate(
      siteId,
      { $set: updates },
      { new: true, runValidators: true, overwrite: false }
    );
		if (!site) return res.status(404).json({ error: 'Not found' });
		res.json(site);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

// Upload site logo and set logoUrl. Defaults to storing inline base64 to avoid
// ephemeral filesystem issues on hosts like Render. To store on disk instead,
// set STORE_SITE_LOGO_IN_DB=false (or STORE_IMAGES_IN_DB=false).
router.post('/:siteId/logo', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    const { siteId } = req.params;
    if (!req.file) return res.status(400).json({ error: 'Missing file' });

    const STORE_IN_DB = String(process.env.STORE_SITE_LOGO_IN_DB || process.env.STORE_IMAGES_IN_DB || 'true')
      .toLowerCase() === 'true';

    let publicUrl = '';
    if (STORE_IN_DB) {
      const mime = (req.file.mimetype && /^image\//.test(req.file.mimetype)) ? req.file.mimetype : 'image/png';
      const base64 = req.file.buffer.toString('base64');
      publicUrl = `data:${mime};base64,${base64}`;
    } else {
      const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
      try { await mkdir(dir, { recursive: true }); } catch {}
      const ext = path.extname(req.file.originalname || '') || '.png';
      const fileName = `site-${siteId}-${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
      const filePath = path.join(dir, fileName);
      await writeFile(filePath, req.file.buffer);
      publicUrl = `/uploads/${fileName}`;
    }

    const mock = req.app.locals.mockData;
    if (mock) {
      const idx = mock.sites.findIndex((s) => s._id === siteId);
      if (idx === -1) return res.status(404).json({ error: 'Not found' });
      mock.sites[idx].logoUrl = publicUrl;
      try { saveMockData(req.app.locals.mockData); } catch {}
      return res.json({ ok: true, logoUrl: publicUrl, site: mock.sites[idx] });
    }
    const updated = await Site.findByIdAndUpdate(siteId, { logoUrl: publicUrl }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, logoUrl: publicUrl, site: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Upload site banner image and set bannerImageUrl. Uses same storage strategy as logo.
router.post('/:siteId/banner', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    const { siteId } = req.params;
    if (!req.file) return res.status(400).json({ error: 'Missing file' });

    const STORE_IN_DB = String(process.env.STORE_SITE_LOGO_IN_DB || process.env.STORE_IMAGES_IN_DB || 'true')
      .toLowerCase() === 'true';

    let publicUrl = '';
    if (STORE_IN_DB) {
      const mime = (req.file.mimetype && /^image\//.test(req.file.mimetype)) ? req.file.mimetype : 'image/jpeg';
      const base64 = req.file.buffer.toString('base64');
      publicUrl = `data:${mime};base64,${base64}`;
    } else {
      const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
      try { await mkdir(dir, { recursive: true }); } catch {}
      const ext = path.extname(req.file.originalname || '') || '.jpg';
      const fileName = `site-banner-${siteId}-${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
      const filePath = path.join(dir, fileName);
      await writeFile(filePath, req.file.buffer);
      publicUrl = `/uploads/${fileName}`;
    }

    const mock = req.app.locals.mockData;
    if (mock) {
      const idx = mock.sites.findIndex((s) => s._id === siteId);
      if (idx === -1) return res.status(404).json({ error: 'Not found' });
      mock.sites[idx].bannerImageUrl = publicUrl;
      try { saveMockData(req.app.locals.mockData); } catch {}
      return res.json({ ok: true, bannerImageUrl: publicUrl, site: mock.sites[idx] });
    }
    const updated = await Site.findByIdAndUpdate(siteId, { bannerImageUrl: publicUrl }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, bannerImageUrl: publicUrl, site: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:siteId', requireAdmin, async (req, res) => {
	try {
		const { siteId } = req.params;
		const mock = req.app.locals.mockData;
		if (mock) {
			const before = mock.sites.length;
			mock.sites = mock.sites.filter((s) => s._id !== siteId);
			if (mock.sites.length === before) return res.status(404).json({ error: 'Not found' });
			mock.categories = mock.categories.filter((c) => c.site !== siteId);
			mock.products = mock.products.filter((p) => p.site !== siteId);
			try { saveMockData(req.app.locals.mockData); } catch {}
			return res.status(204).end();
		}
		await Site.findByIdAndDelete(siteId);
		res.status(204).end();
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

export default router;

// Billing (weekly/monthly totals) for a site
export const adminBillingRouter = Router();

adminBillingRouter.get('/sites/:siteId/billing', requireAdmin, async (req, res) => {
  try {
    const { siteId } = req.params;
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday as start
    startOfWeek.setHours(0,0,0,0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const mock = req.app.locals.mockData;
    if (mock) {
      const orders = (mock.orders || [])
        .filter((o) => o.site === siteId)
        // Include successful, pending, and historical entries without status
        .filter((o) => o.status === 'paid' || o.status === 'confirmed' || o.status === 'awaiting_payment' || !o.status);
      const isToday = (o) => new Date(o.createdAt || 0) >= startOfDay;
      const isWeek = (o) => new Date(o.createdAt || 0) >= startOfWeek;
      const isMonth = (o) => new Date(o.createdAt || 0) >= startOfMonth;
      const sum = (list, field) => list.reduce((s, o) => s + (Number(o[field]) || 0), 0);
      const todayOrders = orders.filter(isToday);
      const weekOrders = orders.filter(isWeek);
      const monthOrders = orders.filter(isMonth);

      const todayTotalCents = sum(todayOrders, 'totalCents');
      const weekTotalCents = sum(weekOrders, 'totalCents');
      const monthTotalCents = sum(monthOrders, 'totalCents');
      const todayDeliveryFeeCents = sum(todayOrders, 'deliveryFeeCents');
      const weekDeliveryFeeCents = sum(weekOrders, 'deliveryFeeCents');
      const monthDeliveryFeeCents = sum(monthOrders, 'deliveryFeeCents');
      const todayTaxCents = sum(todayOrders, 'taxCents');
      const weekTaxCents = sum(weekOrders, 'taxCents');
      const monthTaxCents = sum(monthOrders, 'taxCents');
      const todayTipCents = sum(todayOrders, 'tipCents');
      const weekTipCents = sum(weekOrders, 'tipCents');
      const monthTipCents = sum(monthOrders, 'tipCents');

      // Selling totals exclude delivery fees and tips
      const todaySellingCents = todayTotalCents - todayDeliveryFeeCents - todayTipCents;
      const weekSellingCents = weekTotalCents - weekDeliveryFeeCents - weekTipCents;
      const monthSellingCents = monthTotalCents - monthDeliveryFeeCents - monthTipCents;

      return res.json({
        todayTotalCents: todaySellingCents,
        todayDeliveryFeeCents,
        todayTaxCents,
        weekTotalCents: weekSellingCents,
        monthTotalCents: monthSellingCents,
        todaySellingCents,
        weekSellingCents,
        monthSellingCents,
        weekDeliveryFeeCents,
        monthDeliveryFeeCents,
        weekTaxCents,
        monthTaxCents,
      });
    }

    const paidOrMissingStatus = {
      site: new mongoose.Types.ObjectId(siteId),
      $or: [ { status: { $in: ['paid', 'confirmed', 'awaiting_payment'] } }, { status: { $exists: false } } ],
    };
    const [todayAgg] = await Order.aggregate([
      { $match: { ...paidOrMissingStatus, createdAt: { $gte: startOfDay } } },
      { $group: { _id: null, total: { $sum: '$totalCents' }, deliveryFees: { $sum: '$deliveryFeeCents' }, tax: { $sum: '$taxCents' }, tips: { $sum: '$tipCents' } } },
    ]);
    const [weekAgg] = await Order.aggregate([
      { $match: { ...paidOrMissingStatus, createdAt: { $gte: startOfWeek } } },
      { $group: { _id: null, total: { $sum: '$totalCents' }, deliveryFees: { $sum: '$deliveryFeeCents' }, tax: { $sum: '$taxCents' }, tips: { $sum: '$tipCents' } } },
    ]);
    const [monthAgg] = await Order.aggregate([
      { $match: { ...paidOrMissingStatus, createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$totalCents' }, deliveryFees: { $sum: '$deliveryFeeCents' }, tax: { $sum: '$taxCents' }, tips: { $sum: '$tipCents' } } },
    ]);

    const todaySellingCents = (todayAgg?.total || 0) - (todayAgg?.deliveryFees || 0) - (todayAgg?.tips || 0);
    const weekSellingCents = (weekAgg?.total || 0) - (weekAgg?.deliveryFees || 0) - (weekAgg?.tips || 0);
    const monthSellingCents = (monthAgg?.total || 0) - (monthAgg?.deliveryFees || 0) - (monthAgg?.tips || 0);

    res.json({
      todayTotalCents: todaySellingCents,
      todayDeliveryFeeCents: todayAgg?.deliveryFees || 0,
      todayTaxCents: todayAgg?.tax || 0,
      weekTotalCents: weekSellingCents,
      monthTotalCents: monthSellingCents,
      todaySellingCents,
      weekSellingCents,
      monthSellingCents,
      weekDeliveryFeeCents: weekAgg?.deliveryFees || 0,
      monthDeliveryFeeCents: monthAgg?.deliveryFees || 0,
      weekTaxCents: weekAgg?.tax || 0,
      monthTaxCents: monthAgg?.tax || 0,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

