import { Router } from 'express';
import { tenantBySlug } from '../middleware/tenant.js';
import { requireUser } from '../middleware/auth.js';
import Order from '../models/Order.js';
import Coupon from '../models/Coupon.js';
import Site from '../models/Site.js';
import { getDelivery } from '../services/uberDirect.js';
import { sendOrderEmail } from '../utils/mailer.js';
import PDFDocument from 'pdfkit';

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
      items: items.map((m) => ({ name: m.name, quantity: m.quantity, priceCents: m.priceCents, size: m.size, spiceLevel: m.spiceLevel })),
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
      const created = { _id: `o-${Date.now()}`, createdAt, status: 'confirmed', ...orderPayload };
      req.app.locals.mockData.orders.unshift(created);
      try {
        await sendOrderEmail({ to: created.userEmail, siteName: (req.app.locals.mockData.sites || []).find(s => s._id === req.siteId)?.name || '', orderId: created._id, items: created.items, totalCents: created.totalCents, fulfillmentType: 'pickup' });
      } catch {}
      return res.status(201).json(created);
    }
    const created = await Order.create({ ...orderPayload, status: 'confirmed' });
    try {
      const site = await Site.findById(req.siteId);
      await sendOrderEmail({ to: created.userEmail, siteName: site?.name || '', orderId: created._id, items: created.items, totalCents: created.totalCents, fulfillmentType: 'pickup' });
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
    res.setHeader('Content-Disposition', `attachment; filename=order-${String(order._id).slice(-6)}.pdf`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    const colors = { primary: '#2563eb', primaryText: '#ffffff', text: '#334155', textDark: '#0f172a', border: '#cbd5e1', tableHeader: '#e0f2fe', rowStripe: '#f8fafc' };
    const avail = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Header band
    const y0 = doc.y;
    doc.save();
    doc.rect(doc.page.margins.left, y0, avail, 40).fill(colors.primary);
    doc.restore();
    doc.font('Helvetica-Bold').fontSize(22).fillColor(colors.primaryText).text('Order Invoice', doc.page.margins.left + 12, y0 + 10);
    doc.y = y0 + 52;

    // Order + user
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.textDark).text('Order details');
    doc.font('Helvetica').fontSize(10).fillColor(colors.text);
    doc.text(`Order #: ${String(order._id)}`);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleString()}`);
    doc.text(`Fulfillment: ${order.fulfillmentType}`);
    doc.moveDown(0.6);

    const startX = doc.page.margins.left + 20;
    const col = [260, 60, 85, 90];
    const width = col.reduce((a,b)=>a+b,0);
    const pageBottom = doc.page.height - doc.page.margins.bottom;
    function drawHeader(){
      doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.textDark);
      const headerY = doc.y;
      doc.save();
      doc.rect(startX, headerY, width, 18).fill(colors.tableHeader);
      doc.restore();
      doc.text('Name', startX, headerY + 4, { width: col[0], align: 'center' });
      doc.text('Qty', startX + col[0], headerY + 4, { width: col[1], align: 'center' });
      doc.text('Unit', startX + col[0] + col[1], headerY + 4, { width: col[2], align: 'center' });
      doc.text('Total', startX + col[0] + col[1] + col[2], headerY + 4, { width: col[3], align: 'center' });
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
        .text(`${it.name}${it.spiceLevel ? ' ['+it.spiceLevel+']' : ''}${it.size ? ' — Select Item: '+it.size : ''}`, startX, rowY, { width: col[0], align: 'center' });
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
    const valueX = startX + width - 100;
    const labelWidth = 220;
    function row(label, value){
      const y = doc.y;
      doc.font('Helvetica').fillColor(colors.textDark).text(label, valueX - labelWidth, y, { width: labelWidth, align: 'right' });
      doc.text(`$${(Number(value)||0).toFixed(2)}`, valueX, y, { width: 100, align: 'right' });
      doc.moveDown(0.3);
    }
    row('Items Subtotal', subtotal);
    row('Tax', tax);
    if (delivery > 0) row('Delivery Fee', delivery);
    doc.moveDown(0.2);
    doc.moveTo(startX, doc.y).lineTo(startX + width, doc.y).strokeColor(colors.border).stroke();
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold');
    row('Grand Total', total);

    doc.end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

