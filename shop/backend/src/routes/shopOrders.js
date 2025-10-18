import { Router } from 'express';
import { tenantBySlug } from '../middleware/tenant.js';
import { requireUser } from '../middleware/auth.js';
import Order from '../models/Order.js';
import Coupon from '../models/Coupon.js';
import Site from '../models/Site.js';
import { getDelivery } from '../services/uberDirect.js';
import { sendOrderEmail } from '../utils/mailer.js';
import PDFDocument from 'pdfkit';
import { getNextOrderNumber } from '../utils/orderNumber.js';
import { formatDateTimeInSiteTz } from '../utils/time.js';

const router = Router();

router.use('/:slug', tenantBySlug);

router.get('/:slug/orders/mine', requireUser, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 12));
    const mock = req.app.locals.mockData;
  if (mock) {
      const all = (mock.orders || [])
        .filter((o) => o.site === req.siteId && o.userEmail === req.user?.email)
        // Only show successful orders to users
        .filter((o) => o.status === 'paid' || o.status === 'confirmed');
      const total = all.length;
      const start = (page - 1) * pageSize;
      const items = all.slice(start, start + pageSize);
      return res.json({ items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
    }
    const filter = { site: req.siteId, userId: req.user?.userId, status: { $in: ['paid', 'confirmed'] } };
    const total = await Order.countDocuments(filter);
    const items = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize);
    res.json({ items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get tracking details for a specific order (user's own order only)
router.get('/:slug/orders/:orderId/tracking', requireUser, async (req, res) => {
  try {
    const { orderId } = req.params;
    const mock = req.app.locals.mockData;
    let order;
    if (mock) {
      order = (mock.orders || []).find((o) => String(o._id) === String(orderId) && o.site === req.siteId);
      if (!order) return res.status(404).json({ error: 'Order not found' });
      if (String(order.userEmail || '') !== String(req.user?.email || '')) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      return res.json({
        uberDeliveryId: order.uberDeliveryId,
        uberTrackingUrl: order.uberTrackingUrl,
        uberStatus: order.uberStatus || 'unknown',
      });
    }
    order = await Order.findOne({ _id: orderId, site: req.siteId, userId: req.user?.userId });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    // If we have Uber delivery ID and site has uberCustomerId, fetch live status
    const site = await Site.findById(req.siteId);
    let live;
    if (site?.uberCustomerId && order?.uberDeliveryId) {
      try {
        live = await getDelivery({ customerId: site.uberCustomerId, deliveryId: order.uberDeliveryId, creds: { clientId: site?.uberClientId, clientSecret: site?.uberClientSecret, env: site?.uberEnv, scopes: site?.uberTokenScopes } });
      } catch (e) {
        // ignore live fetch errors; fall back to stored fields
      }
    }
    const trackingUrl = live?.tracking_url || live?.trackingUrl || live?.share_url || order.uberTrackingUrl || '';
    const status = live?.status || live?.state || live?.current_status || order.uberStatus || 'unknown';
    res.json({
      uberDeliveryId: order.uberDeliveryId,
      uberTrackingUrl: trackingUrl,
      uberStatus: status,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create a pickup order (no Uber delivery). Requires user or admin auth.
router.post('/:slug/orders/pickup', requireUser, async (req, res) => {
  try {
    const { items, pickup, notes, coupon } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Items required' });
    let itemsTotal = items.reduce((s, it) => s + (Number(it.priceCents)||0) * (Number(it.quantity)||1), 0);
    const COUPON_MIN_SUBTOTAL_CENTS = Math.max(0, Number(process.env.COUPON_MIN_SUBTOTAL_CENTS) || 5000);
    const subtotalBeforeDiscount = itemsTotal;
    // Apply coupon discount if valid
    let appliedCoupon = null;
    const mock = req.app.locals.mockData;
    if (coupon && coupon.code && typeof coupon.percent === 'number' && subtotalBeforeDiscount >= COUPON_MIN_SUBTOTAL_CENTS) {
      const code = String(coupon.code).trim().toUpperCase();
      const pct = Math.max(0, Math.min(100, Number(coupon.percent)||0));
      if (mock) {
        const found = (mock.coupons || []).find((c) => c.site === req.siteId && c.code === code);
        if (found && Number(found.percent) === pct) {
          const discountedItemsSubtotal = items.reduce((sum, it) => {
            const unit = Number(it.priceCents) || 0;
            const discountedUnit = Math.round(unit * (100 - pct) / 100);
            return sum + discountedUnit * (Number(it.quantity) || 1);
          }, 0);
          itemsTotal = Math.max(0, discountedItemsSubtotal);
          appliedCoupon = { code, percent: pct };
        }
      } else {
        const found = await Coupon.findOne({ site: req.siteId, code });
        if (found && Number(found.percent) === pct) {
          const discountedItemsSubtotal = items.reduce((sum, it) => {
            const unit = Number(it.priceCents) || 0;
            const discountedUnit = Math.round(unit * (100 - pct) / 100);
            return sum + discountedUnit * (Number(it.quantity) || 1);
          }, 0);
          itemsTotal = Math.max(0, discountedItemsSubtotal);
          appliedCoupon = { code, percent: pct };
        }
      }
    }
    const isMockEnv = !!req.app?.locals?.mockData;
    const minOrderCents = isMockEnv ? 0 : Math.max(0, Number(process.env.MIN_ORDER_CENTS) || 5000);
    // Enforce minimum order on pre-discount subtotal for consistency with delivery and Stripe flows
    if (subtotalBeforeDiscount < minOrderCents) {
      return res.status(400).json({ error: `Minimum order is $${(minOrderCents/100).toFixed(2)}` });
    }
    const taxCents = Math.round(itemsTotal * 0.05);
    const totalCents = itemsTotal + taxCents;
    const orderPayload = {
      site: req.siteId,
      userId: req.user?.userId,
      userEmail: req.user?.email,
      items: items.map((m) => ({ name: m.name, quantity: m.quantity, priceCents: m.priceCents, size: m.size, spiceLevel: m.spiceLevel, flavor: m.flavor, portion: m.portion })),
      totalCents,
      taxCents,
      tipCents: 0,
      fulfillmentType: 'pickup',
      pickup,
      notes: typeof notes === 'string' ? notes.slice(0, 1000) : undefined,
      meta: appliedCoupon ? { coupon: appliedCoupon } : undefined,
    };
    if (req.app.locals.mockData) {
      if (!Array.isArray(req.app.locals.mockData.orders)) req.app.locals.mockData.orders = [];
      const createdAt = new Date().toISOString();
      // Mock-mode order number sequence
      const nextSeq = ((req.app.locals.mockData.orderSeq || 1000) + 1);
      req.app.locals.mockData.orderSeq = nextSeq;
      const created = { _id: `o-${Date.now()}`, createdAt, status: 'confirmed', orderNumber: `BB-${nextSeq}`, ...orderPayload };
      req.app.locals.mockData.orders.unshift(created);
      try {
        await sendOrderEmail({ to: created.userEmail, siteName: (req.app.locals.mockData.sites || []).find(s => s._id === req.siteId)?.name || '', orderId: created._id, orderNumber: created.orderNumber, items: created.items, totalCents: created.totalCents, fulfillmentType: 'pickup' });
      } catch {}
      return res.status(201).json(created);
    }
    const orderNumber = await getNextOrderNumber(req.siteId);
    const created = await Order.create({ ...orderPayload, status: 'confirmed', orderNumber });
    try {
      const site = await Site.findById(req.siteId);
      await sendOrderEmail({ to: created.userEmail, siteName: site?.name || '', orderId: created._id, orderNumber: created.orderNumber, items: created.items, totalCents: created.totalCents, fulfillmentType: 'pickup' });
    } catch {}
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

// Generate a PDF invoice for a user's own order
router.get('/:slug/orders/:orderId/pdf', requireUser, async (req, res) => {
  try {
    const { orderId } = req.params;
    const mock = req.app.locals.mockData;
    let order;
    if (mock) {
      order = (mock.orders || []).find((o) => String(o._id) === String(orderId) && o.site === req.siteId);
      if (!order) return res.status(404).json({ error: 'Order not found' });
      if (String(order.userEmail || '') !== String(req.user?.email || '')) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } else {
      order = await Order.findOne({ _id: orderId, site: req.siteId, userId: req.user?.userId });
      if (!order) return res.status(404).json({ error: 'Order not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    const fileId = (order.orderNumber || String(order._id).slice(-6)).replace(/\s+/g, '');
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

    // Two-column header: Restaurant/Customer on the left, Delivery/Order details on the right
    const availableWidth = avail;
    const columnGap = 16;
    const columnWidth = (availableWidth - columnGap) / 2;
    const leftX = doc.page.margins.left;
    const rightX = leftX + columnWidth + columnGap;
    const topY = doc.y;
    // Left column: Restaurant then Customer
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.textDark).text('RESTAURANT', leftX, topY);
    doc.font('Helvetica').fontSize(10).fillColor(colors.text);
    if (order.pickup?.location) {
      const p = order.pickup.location;
      const addr = Array.isArray(p?.address?.streetAddress) ? p.address.streetAddress.join(' ') : '';
      doc.text(`${p.name || 'Restaurant'}`, leftX, doc.y, { width: columnWidth });
      doc.text(`${addr} ${p?.address?.city || ''} ${p?.address?.province || ''} ${p?.address?.postalCode || ''}`, leftX, doc.y, { width: columnWidth });
    }
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.textDark).text('CUSTOMER', leftX, doc.y);
    doc.font('Helvetica').fontSize(10).fillColor(colors.text);
    if (order.dropoff) {
      const d = order.dropoff || {};
      const addr = Array.isArray(d?.address?.streetAddress) ? d.address.streetAddress.join(' ') : '';
      doc.text(`Name: ${d.name || '—'}`, leftX, doc.y, { width: columnWidth });
      doc.text(`Phone: ${d.phone || '—'}`, leftX, doc.y, { width: columnWidth });
      doc.text(`Address: ${addr} ${d?.address?.city || ''} ${d?.address?.province || ''} ${d?.address?.postalCode || ''}`, leftX, doc.y, { width: columnWidth });
    } else if (order.userEmail) {
      doc.text(`Customer: ${order.userEmail}`, leftX, doc.y, { width: columnWidth });
    }
    const leftEndY = doc.y;

    // Right column: Delivery details (or Order details for pickup)
    const rightHdr = (order.fulfillmentType || 'pickup') === 'delivery' ? 'DELIVERY DETAILS' : 'ORDER DETAILS';
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.textDark).text(rightHdr, rightX, topY);
    doc.font('Helvetica').fontSize(10).fillColor(colors.text);
    doc.text(`Order #: ${order.orderNumber || String(order._id)}`, rightX, doc.y, { width: columnWidth });
    doc.text(`Date: ${formatDateTimeInSiteTz(order.createdAt, req.site)}`, rightX, doc.y, { width: columnWidth });
    const fulfillmentUpperC = String(order.fulfillmentType || 'pickup').toUpperCase();
    doc.text(`Fulfillment: ${fulfillmentUpperC}`, rightX, doc.y, { width: columnWidth });
    const rightEndY = doc.y;
    doc.y = Math.max(leftEndY, rightEndY) + 10;
    doc.moveDown(0.2);

    const startX = doc.page.margins.left + 20;
    const col = [260, 60, 85, 90];
    const width = col.reduce((a,b)=>a+b,0);
    const pageBottom = doc.page.height - doc.page.margins.bottom;
    function drawHeader(){
      // Section title
      doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.textDark)
        .text('ORDER SUMMARY', startX, doc.y, { width: width, align: 'center' });
      doc.moveDown(0.4);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.textDark);
      const headerY = doc.y;
      doc.save();
      doc.rect(startX, headerY, width, 18).fill(colors.tableHeader);
      doc.restore();
      doc.text('NAME', startX, headerY + 4, { width: col[0], align: 'center' });
      doc.text('QTY', startX + col[0], headerY + 4, { width: col[1], align: 'center' });
      doc.text('UNIT', startX + col[0] + col[1], headerY + 4, { width: col[2], align: 'center' });
      doc.text('TOTAL', startX + col[0] + col[1] + col[2], headerY + 4, { width: col[3], align: 'center' });
      doc.moveDown(1.2);
      doc.moveTo(startX, doc.y).lineTo(startX + width, doc.y).strokeColor(colors.border).stroke();
    }
    function ensure(){ if (doc.y + 22 > pageBottom) { doc.addPage(); drawHeader(); } }
    drawHeader();
    let subtotal = 0;
    (Array.isArray(order.items) ? order.items : []).forEach((it, idx) => {
      ensure();
      const unit = Number(it.priceCents||0)/100;
      const qty = Number(it.quantity||1);
      const line = unit * qty;
      subtotal += line;
      if (idx % 2 === 0) { doc.save(); doc.rect(startX, doc.y - 2, width, 18).fill(colors.rowStripe); doc.restore(); }
      const rowY = doc.y;
      doc.font('Helvetica').fillColor(colors.text)
        .text(`${it.name}${it.flavor ? ' — Flavor: '+it.flavor : ''}${it.portion ? ' — Portion: '+it.portion : ''}${it.spiceLevel ? ' ['+it.spiceLevel+']' : ''}${it.size ? ' ('+it.size+')' : ''}`, startX, rowY, { width: col[0], align: 'center' });
      doc.text(String(qty), startX + col[0], rowY, { width: col[1], align: 'center' });
      doc.text(`$${unit.toFixed(2)}`, startX + col[0] + col[1], rowY, { width: col[2], align: 'center' });
      doc.text(`$${line.toFixed(2)}`, startX + col[0] + col[1] + col[2], rowY, { width: col[3], align: 'center' });
      doc.moveDown(0.4);
      doc.moveTo(startX, doc.y).lineTo(startX + width, doc.y).strokeColor(colors.border).stroke();
    });

    doc.moveDown();
    const tax = Number(order.taxCents||0)/100;
    const delivery = Number(order.deliveryFeeCents||0)/100; // show only customer's half if split
    const total = Number(order.totalCents||0)/100;
    const coupon = order.meta?.coupon;
    const valueX = startX + width - 100;
    const labelWidth = 220;
    function row(label, value){
      const y = doc.y;
      doc.font('Helvetica').fillColor(colors.textDark).text(label, valueX - labelWidth, y, { width: labelWidth, align: 'right' });
      doc.text(`$${(Number(value)||0).toFixed(2)}`, valueX, y, { width: 100, align: 'right' });
      doc.moveDown(0.3);
    }
    row('ITEMS SUBTOTAL', subtotal);
    if (coupon && typeof coupon.percent === 'number') {
      const discount = subtotal * (Number(coupon.percent) / 100);
      row(`DISCOUNT ${coupon.code ? '('+coupon.code+')' : ''} (-${coupon.percent}% )`, -discount);
    }
    row('TAX (5%)', tax);
    if ((order.fulfillmentType || 'pickup') === 'delivery' && delivery > 0) row('DELIVERY CHARGE', delivery);
    doc.moveDown(0.2);
    doc.moveTo(startX, doc.y).lineTo(startX + width, doc.y).strokeColor(colors.border).stroke();
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold');
    row('GRAND TOTAL', total);

    doc.end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

