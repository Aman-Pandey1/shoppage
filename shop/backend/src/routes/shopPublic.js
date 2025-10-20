import { Router } from 'express';
import { tenantBySlug, tenantByHost } from '../middleware/tenant.js';
import { requireUser } from '../middleware/auth.js';
import PDFDocument from 'pdfkit';
import Order from '../models/Order.js';
import Site from '../models/Site.js';
import { formatDateTimeInSiteTz } from '../utils/time.js';
import { getNextOrderNumber } from '../utils/orderNumber.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';

const router = Router();

// Normalize product shape for frontend compatibility
// - Ensure variants[] has a numeric `price` (fallback to `priceDelta` from legacy data)
function normalizeProductShape(p) {
  if (!p) return p;
  const obj = (typeof p.toObject === 'function') ? p.toObject() : { ...p };
  if (Array.isArray(obj.variants)) {
    obj.variants = obj.variants.map((v) => {
      const key = String(v?.key || v?.label || 'variant').trim();
      const label = String(v?.label || v?.key || 'Variant').trim();
      const price = Number((v?.price ?? v?.priceDelta) || 0) || 0;
      return { key, label, price };
    });
  }
  if (Array.isArray(obj.flavors)) {
    obj.flavors = obj.flavors.map((v) => {
      const key = String(v?.key || v?.label || 'flavor').trim();
      const label = String(v?.label || v?.key || 'Flavor').trim();
      const price = Number((v?.price ?? v?.priceDelta) || 0) || 0;
      return { key, label, price };
    });
  }
  if (Array.isArray(obj.portions)) {
    obj.portions = obj.portions.map((v) => {
      const key = String(v?.key || v?.label || 'portion').trim();
      const label = String(v?.label || v?.key || 'Portion').trim();
      const price = Number((v?.price ?? v?.priceDelta) || 0) || 0;
      return { key, label, price };
    });
  }
  if (Array.isArray(obj.quantities)) {
    obj.quantities = obj.quantities.map((v) => {
      const key = String(v?.key || v?.label || 'quantity').trim();
      const label = String(v?.label || v?.key || 'Quantity').trim();
      const price = Number((v?.price ?? v?.priceDelta) || 0) || 0;
      return { key, label, price };
    });
  }
  return obj;
}

// Infer a reasonable Canadian IANA time zone when not explicitly set
function inferCanadaTimeZoneFromSite(siteLike) {
  try {
    const getProvince = () => {
      const fromPickup = siteLike?.pickup?.address?.province;
      if (fromPickup) return String(fromPickup).toUpperCase();
      const firstLocProv = Array.isArray(siteLike?.locations) && siteLike.locations.length
        ? siteLike.locations[0]?.address?.province
        : undefined;
      return String(firstLocProv || '').toUpperCase();
    };
    const country = String(siteLike?.pickup?.address?.country || siteLike?.locations?.[0]?.address?.country || '').toUpperCase();
    if (country && country !== 'CA') return undefined;
    const prov = getProvince();
    const MAP = {
      NL: 'America/St_Johns',
      NS: 'America/Halifax',
      PE: 'America/Halifax',
      NB: 'America/Halifax',
      QC: 'America/Toronto',
      ON: 'America/Toronto',
      MB: 'America/Winnipeg',
      SK: 'America/Regina',
      AB: 'America/Edmonton',
      BC: 'America/Vancouver',
      YT: 'America/Whitehorse',
      NT: 'America/Yellowknife',
      NU: 'America/Iqaluit',
    };
    return MAP[prov] || undefined;
  } catch {
    return undefined;
  }
}

// Resolve by current request host -> return site basics
router.get('/host-site', tenantByHost, async (req, res) => {
	try {
		const { site } = req;
		return res.json({ siteId: req.siteId, slug: site.slug, name: site.name });
	} catch (err) {
		return res.status(400).json({ error: err.message });
	}
});

// Legacy-compatible: Generate a PDF invoice for a user's order WITHOUT slug in path
// Path: /api/shop/orders/:orderId/pdf
// This resolves the site from the order itself and enforces ownership by the authenticated user.
router.get('/orders/:orderId/pdf', requireUser, async (req, res) => {
  try {
    const { orderId } = req.params;
    const mock = req.app.locals.mockData;
    let order;
    let siteLike;
    if (mock) {
      order = (mock.orders || []).find((o) => String(o._id) === String(orderId));
      if (!order) return res.status(404).json({ error: 'Order not found' });
      if (String(order.userEmail || '') !== String(req.user?.email || '')) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (!order.orderNumber) {
        const nextSeq = ((req.app.locals.mockData.orderSeq || 1000) + 1);
        req.app.locals.mockData.orderSeq = nextSeq;
        order.orderNumber = `BB-${nextSeq}`;
      }
      siteLike = (mock.sites || []).find((s) => String(s._id) === String(order.site));
    } else {
      const email = String(req.user?.email || '').trim();
      const or = [];
      if (req.user?.userId) or.push({ userId: req.user.userId });
      if (email) or.push({ userEmail: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`, 'i') } });
      order = await Order.findOne({ _id: orderId, ...(or.length ? { $or: or } : {}) });
      if (!order) return res.status(404).json({ error: 'Order not found' });
      if (!order.orderNumber) {
        try {
          const assigned = await getNextOrderNumber(order.site);
          await Order.findByIdAndUpdate(order._id, { orderNumber: assigned });
          order.orderNumber = assigned;
        } catch {}
      }
      try { siteLike = await Site.findById(order.site); } catch {}
    }

    res.setHeader('Content-Type', 'application/pdf');
    const prefixRaw = process.env.ORDER_NUMBER_PREFIX || 'BB-';
    const prefixSafe = String(prefixRaw).endsWith('-') ? String(prefixRaw) : `${String(prefixRaw)}-`;
    const fileId = (order.orderNumber || `${prefixSafe}${String(order._id).slice(-6)}`).replace(/\s+/g, '');
    res.setHeader('Content-Disposition', `attachment; filename=order-${fileId}.pdf`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    const colors = { primary: '#2563eb', primaryText: '#ffffff', text: '#334155', textDark: '#0f172a', border: '#cbd5e1', tableHeader: '#e0f2fe', rowStripe: '#f8fafc' };
    const avail = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Header band
    const y0 = doc.y;
    doc.save();
    doc.rect(doc.page.margins.left, y0, avail, 40).fill(colors.primary);
    doc.restore();
    doc.font('Helvetica-Bold').fontSize(22).fillColor(colors.primaryText).text('ORDER INVOICE', doc.page.margins.left + 12, y0 + 10);
    doc.y = y0 + 52;

    // Two-column header: Restaurant/Customer (left) and Order details (right)
    const availableWidth = avail;
    const columnGap = 16;
    const columnWidth = (availableWidth - columnGap) / 2;
    const leftX = doc.page.margins.left;
    const rightX = leftX + columnWidth + columnGap;
    const topY = doc.y;
    // Left column: Restaurant
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.textDark).text('RESTAURANT ADDRESS', leftX, topY);
    doc.font('Helvetica').fontSize(10).fillColor(colors.text);
    if (order.pickup?.location) {
      const p = order.pickup.location;
      const addr = Array.isArray(p?.address?.streetAddress) ? p.address.streetAddress.join(' ') : '';
      doc.text(`${p.name || 'Restaurant'}`, leftX, doc.y, { width: columnWidth });
      doc.text(`Address: ${addr} ${p?.address?.city || ''} ${p?.address?.province || ''} ${p?.address?.postalCode || ''}`, leftX, doc.y, { width: columnWidth });
    }
    doc.moveDown(0.6);
    // Customer
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.textDark).text('CUSTOMER ADDRESS', leftX, doc.y);
    doc.font('Helvetica').fontSize(10).fillColor(colors.text);
    {
      const isDelivery = String(order.fulfillmentType || (order.dropoff ? 'delivery' : 'pickup')) === 'delivery';
      if (isDelivery) {
        if (order.dropoff) {
          const d = order.dropoff || {};
          const addr = Array.isArray(d?.address?.streetAddress) ? d.address.streetAddress.join(' ') : '';
          doc.text(`Name: ${d.name || '—'}`, leftX, doc.y, { width: columnWidth });
          doc.text(`Phone: ${d.phone || '—'}`, leftX, doc.y, { width: columnWidth });
          doc.text(`Address: ${addr} ${d?.address?.city || ''} ${d?.address?.province || ''} ${d?.address?.postalCode || ''}`, leftX, doc.y, { width: columnWidth });
        } else {
          doc.text('Delivery', leftX, doc.y, { width: columnWidth });
        }
      } else {
        doc.text('Pickup', leftX, doc.y, { width: columnWidth });
      }
    }
    const leftEndY = doc.y;

    // Right column: Order details
    const rightHdr = 'ORDER DETAIL';
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.textDark).text(rightHdr, rightX, topY);
    doc.font('Helvetica').fontSize(10).fillColor(colors.text);
    const displayOrderId = order.orderNumber || `${prefixSafe}${String(order._id).slice(-6)}`;
    doc.text(`Order #: ${displayOrderId}`, rightX, doc.y, { width: columnWidth });
    doc.text(`Date: ${formatDateTimeInSiteTz(order.createdAt, siteLike, { forceMdtLabel: true })}`, rightX, doc.y, { width: columnWidth });
    const fulfillmentUpperC = String(order.fulfillmentType || 'pickup').toUpperCase();
    doc.text(`Fulfillment: ${fulfillmentUpperC}`, rightX, doc.y, { width: columnWidth });
    const rightEndY = doc.y;
    doc.y = Math.max(leftEndY, rightEndY) + 10;
    doc.moveDown(0.2);

    // Items list
    const listX = doc.page.margins.left + 20;
    const listWidth = avail - 40;
    const priceColWidth = 100;
    const pageBottom = doc.page.height - doc.page.margins.bottom;
    function drawSectionTitle(){
      doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.textDark)
        .text('ORDER SUMMARY', listX, doc.y, { width: listWidth, align: 'center' });
      doc.moveDown(0.6);
    }
    function ensureRow(){ if (doc.y + 20 > pageBottom) { doc.addPage(); drawSectionTitle(); } }
    drawSectionTitle();
    let subtotal = 0;
    (Array.isArray(order.items) ? order.items : []).forEach((it) => {
      ensureRow();
      const unit = Number(it.priceCents||0)/100;
      const qty = Number(it.quantity||1);
      const line = unit * qty;
      subtotal += line;
      const rowY = doc.y;
      let label = `${it.name}`;
      if (it.size) label += ` (${it.size})`;
      if (it.flavor) label += ` — Flavor: ${it.flavor}`;
      if (it.portion) label += ` — Portion: ${it.portion}`;
      if (it.spiceLevel) label += ` [${it.spiceLevel}]`;
      label += ` x${qty}`;
      doc.font('Helvetica').fontSize(10).fillColor(colors.text)
        .text(label, listX, rowY, { width: listWidth - priceColWidth - 12, align: 'left' });
      doc.font('Helvetica').fontSize(10).fillColor(colors.textDark)
        .text(`$${line.toFixed(2)}`, listX + listWidth - priceColWidth, rowY, { width: priceColWidth, align: 'right' });
      doc.moveDown(0.2);
      doc.moveTo(listX, doc.y).lineTo(listX + listWidth, doc.y).strokeColor(colors.border).stroke();
    });

    doc.moveDown();
    const tax = Number(order.taxCents||0)/100;
    const delivery = Number(order.deliveryFeeCents||0)/100;
    const total = Number(order.totalCents||0)/100;
    const coupon = order.meta?.coupon;
    const valueX = listX + listWidth - priceColWidth;
    const labelWidth = 220;
    function row(label, value){
      const y = doc.y;
      doc.font('Helvetica').fillColor(colors.textDark).text(label, valueX - labelWidth, y, { width: labelWidth, align: 'right' });
      doc.text(`$${(Number(value)||0).toFixed(2)}`, valueX, y, { width: 100, align: 'right' });
      doc.moveDown(0.3);
    }
    row('ITEMS SUBTOTAL', subtotal);
    const itemsAfterDiscount = Math.max(0, total - tax - ((order.fulfillmentType || 'pickup') === 'delivery' ? delivery : 0));
    const computedDiscount = Math.max(0, subtotal - itemsAfterDiscount);
    if (computedDiscount > 0.0001) {
      const discountLabel = (coupon && typeof coupon.percent === 'number')
        ? `DISCOUNT ${coupon.code ? '('+coupon.code+')' : ''} (-${coupon.percent}% )`
        : 'DISCOUNT';
      row(discountLabel, -computedDiscount);
    }
    row('TAX (5%)', tax);
    if ((order.fulfillmentType || 'pickup') === 'delivery' && delivery > 0) row('DELIVERY CHARGE', delivery);
    doc.moveDown(0.2);
    doc.moveTo(listX, doc.y).lineTo(listX + listWidth, doc.y).strokeColor(colors.border).stroke();
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold');
    row('TOTAL', total);

    // Footer
    doc.moveDown(1.2);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.textDark)
      .text('THANK YOU FOR YOUR ORDER!', doc.page.margins.left, doc.y, { width: avail, align: 'center', lineBreak: false });

    doc.end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Resolve site by :slug for all below
router.use('/:slug', tenantBySlug);

// Public config for frontend: expose safe, public keys
// This endpoint returns only non-sensitive configuration intended for the browser.
router.get('/:slug/public-config', async (req, res) => {
  try {
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || '';
    return res.json({ googleMapsApiKey });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Site basics by slug (for UI display or tagging external refs)
router.get('/:slug/site', async (req, res) => {
  try {
    const { site } = req;
    // Expose min order so frontend can display requirement in delivery modal
    const minOrderCents = (typeof site.minOrderCents === 'number')
      ? Math.max(0, Number(site.minOrderCents) || 0)
      : Math.max(0, Number(process.env.MIN_ORDER_CENTS) || 5000);
    // Also expose coupon minimum subtotal so frontend can determine discount eligibility
    const couponMinSubtotalCents = (typeof site.couponMinSubtotalCents === 'number')
      ? Math.max(0, Number(site.couponMinSubtotalCents) || 0)
      : Math.max(0, Number(process.env.COUPON_MIN_SUBTOTAL_CENTS) || 5000);
    // Expose free-delivery configuration for client UX
    const freeDeliveryEnabled = !!site.freeDeliveryEnabled;
    const freeDeliveryMinSubtotalCents = (typeof site.freeDeliveryMinSubtotalCents === 'number')
      ? Math.max(0, Number(site.freeDeliveryMinSubtotalCents) || 0)
      : undefined;
    return res.json({
      siteId: req.siteId,
      slug: site.slug,
      name: site.name,
      brandColor: site.brandColor,
      headerColor: site.headerColor,
      timeZone: site.timeZone,
      deliveryFeeCents: Number(site.deliveryFeeCents) || 0,
      splitDeliveryFee: !!site.splitDeliveryFee,
      maxDeliveryDistanceKm: (typeof site.maxDeliveryDistanceKm === 'number' ? site.maxDeliveryDistanceKm : undefined),
      logoUrl: site.logoUrl,
      bannerImageUrl: site.bannerImageUrl,
      logoLinkUrl: site.logoLinkUrl,
      tagline: site.tagline || '',
      supportWhatsappPhone: site.supportWhatsappPhone || '',
      minOrderCents,
      couponMinSubtotalCents,
      freeDeliveryEnabled,
      freeDeliveryMinSubtotalCents,
      currency: (site.currency || String(process.env.STRIPE_CURRENCY || 'usd').toLowerCase()),
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Public: list of pickup locations for a site (falls back to legacy single pickup)
router.get('/:slug/locations', async (req, res) => {
  try {
    const { site } = req;
    const mock = req.app.locals.mockData;
    if (mock) {
      const s = mock.sites.find((x) => x._id === req.siteId) || {};
      const fromLegacy = s?.pickup ? [{
        name: s.pickup.name,
        phone: s.pickup.phone,
        address: s.pickup.address,
      }] : [];
      return res.json(Array.isArray(s?.locations) && s.locations.length ? s.locations : fromLegacy);
    }
    const list = Array.isArray(site.locations) && site.locations.length
      ? site.locations
      : (site.pickup ? [{ name: site.pickup.name, phone: site.pickup.phone, address: site.pickup.address }] : []);
    return res.json(list);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Public: get opening hours for a site
router.get('/:slug/hours', async (req, res) => {
  try {
    const { site } = req;
    const defaultHours = {
      // Default store hours: 10:00 AM – 10:00 PM (last order 9:45 PM)
      mon: { open: '10:00', close: '22:00', closed: false },
      tue: { open: '10:00', close: '22:00', closed: false },
      wed: { open: '10:00', close: '22:00', closed: false },
      thu: { open: '10:00', close: '22:00', closed: false },
      fri: { open: '10:00', close: '22:00', closed: false },
      sat: { open: '10:00', close: '22:00', closed: false },
      sun: { open: '10:00', close: '22:00', closed: false },
    };
    const mock = req.app.locals.mockData;
    if (mock) {
      const s = mock.sites.find((x) => x._id === req.siteId) || {};
      const resolvedTz = s.timeZone || inferCanadaTimeZoneFromSite(s) || undefined;
      return res.json({ hours: s.hours || defaultHours, timeZone: resolvedTz });
    }
    const resolvedTz = site.timeZone || inferCanadaTimeZoneFromSite(site) || undefined;
    return res.json({ hours: site.hours || defaultHours, timeZone: resolvedTz });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Public: list of supported cities for delivery selection
router.get('/:slug/cities', async (req, res) => {
  try {
    const { site } = req;
    const mock = req.app.locals.mockData;
    if (mock) {
      const s = mock.sites.find((x) => x._id === req.siteId) || {};
      return res.json(Array.isArray(s?.cities) ? s.cities : []);
    }
    return res.json(Array.isArray(site.cities) ? site.cities : []);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/:slug/categories', async (req, res) => {
	try {
		const mock = req.app.locals.mockData;
		if (mock) {
			const categories = mock.categories.filter((c) => c.site === req.siteId).sort((a, b) => (a.sortIndex - b.sortIndex) || a.name.localeCompare(b.name));
			return res.json(categories);
		}
		const categories = await Category.find({ site: req.siteId }).sort({ sortIndex: 1, name: 1 });
		res.json(categories);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

router.get('/:slug/products', async (req, res) => {
	try {
		const mock = req.app.locals.mockData;
		const { categoryId, veg, isVeg } = req.query;
		if (mock) {
			let list = mock.products.filter((p) => p.site === req.siteId);
			if (categoryId) list = list.filter((p) => String(p.categoryId) === String(categoryId));
			// veg filter: veg=veg|nonveg or isVeg=true|false
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
      return res.json(list.map(normalizeProductShape));
		}
		const filter = { site: req.siteId };
		if (categoryId) filter.categoryId = categoryId;
		if (typeof veg === 'string') {
			if (veg.toLowerCase() === 'veg') filter.isVeg = true;
			if (veg.toLowerCase() === 'nonveg') filter.isVeg = false;
		}
		if (typeof isVeg === 'string') {
			if (isVeg.toLowerCase() === 'true') filter.isVeg = true;
			if (isVeg.toLowerCase() === 'false') filter.isVeg = false;
		}
    const products = await Product.find(filter)
      .select('name description imageUrl price categoryId isVeg spiceLevels variants flavors portions quantities extraOptionGroups')
      .sort({ name: 1 });
    res.json(products.map(normalizeProductShape));
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

// Public: validate coupon by code for a site
router.get('/:slug/coupon/:code', async (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const mock = req.app.locals.mockData;
    if (mock) {
      const site = req.siteId;
      const list = mock.coupons || [];
      const found = list.find((c) => c.site === site && c.code === code);
      if (!found) return res.status(404).json({ error: 'Invalid coupon' });
      return res.json({ code: found.code, percent: Number(found.percent) || 0 });
    }
    const found = await Coupon.findOne({ site: req.siteId, code });
    if (!found) return res.status(404).json({ error: 'Invalid coupon' });
    return res.json({ code: found.code, percent: Number(found.percent) || 0 });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Public: get the latest coupon for a site (for auto-apply)
router.get('/:slug/default-coupon', async (req, res) => {
  try {
    const mock = req.app.locals.mockData;
    if (mock) {
      const site = req.siteId;
      const list = (mock.coupons || []).filter((c) => c.site === site);
      if (!list.length) return res.status(404).json({ error: 'No coupons' });
      const sorted = list.slice().sort((a, b) => {
        const ta = new Date(a.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || 0).getTime();
        return tb - ta;
      });
      const chosen = sorted[0];
      return res.json({ code: chosen.code, percent: Number(chosen.percent) || 0 });
    }
    const found = await Coupon.findOne({ site: req.siteId }).sort({ createdAt: -1 });
    if (!found) return res.status(404).json({ error: 'No coupons' });
    return res.json({ code: found.code, percent: Number(found.percent) || 0 });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;

