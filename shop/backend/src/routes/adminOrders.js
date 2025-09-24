import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import Order from '../models/Order.js';
import PDFDocument from 'pdfkit';

const router = Router({ mergeParams: true });

// List orders for a site with optional from/to date filters (inclusive)
router.get('/', requireAdmin, async (req, res) => {
	try {
		const { siteId } = req.params;
		const { from, to } = req.query;
		const mock = req.app.locals.mockData;

		const fromDate = from ? new Date(from) : null;
		const toDate = to ? new Date(to) : null;
		if (toDate) {
			// include the entire 'to' day if only date provided
			if (String(to).length <= 10) toDate.setHours(23, 59, 59, 999);
		}

		if (mock) {
			let list = Array.isArray(mock.orders) ? mock.orders : [];
			list = list.filter((o) => o.site === siteId);
			if (fromDate) list = list.filter((o) => new Date(o.createdAt) >= fromDate);
			if (toDate) list = list.filter((o) => new Date(o.createdAt) <= toDate);
			list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
			return res.json(list);
		}

		const filter = { site: siteId };
		if (fromDate || toDate) filter.createdAt = {};
		if (fromDate) filter.createdAt.$gte = fromDate;
		if (toDate) filter.createdAt.$lte = toDate;
		const orders = await Order.find(filter).sort({ createdAt: -1 });
		res.json(orders);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

export default router;

// Generate a simple PDF invoice for a given order
router.get('/:orderId/pdf', requireAdmin, async (req, res) => {
  try {
    const { siteId, orderId } = req.params;
    const mock = req.app.locals.mockData;
    let order;
    if (mock) {
      order = (mock.orders || []).find((o) => String(o._id) === String(orderId) && String(o.site) === String(siteId));
    } else {
      order = await Order.findOne({ _id: orderId, site: siteId });
    }
    if (!order) return res.status(404).json({ error: 'Order not found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=order-${String(order._id).slice(-6)}.pdf`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    // Header + meta line
    doc.fontSize(20).fillColor('#000').text('Order Invoice', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#555').text(`Order #: ${String(order._id)}`);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleString()}`);
    doc.text(`Fulfillment: ${order.fulfillmentType || (order.dropoff ? 'delivery' : 'pickup')}`);

    // Two-column block: Customer and Restaurant
    doc.moveDown(0.8);
    const leftX = doc.x;
    const midX = leftX + 250;
    const topY = doc.y;
    // Left: Customer
    doc.fontSize(12).fillColor('#000').text('Customer', leftX, topY);
    doc.fontSize(10).fillColor('#333');
    if (order.dropoff) {
      const d = order.dropoff || {};
      const addr = Array.isArray(d?.address?.streetAddress) ? d.address.streetAddress.join(' ') : '';
      doc.text(`Name: ${d.name || '—'}`, leftX, doc.y);
      doc.text(`Phone: ${d.phone || '—'}`, leftX, doc.y);
      doc.text(`Address: ${addr} ${d?.address?.city || ''} ${d?.address?.province || ''} ${d?.address?.postalCode || ''}`, leftX, doc.y, { width: 240 });
    } else if (order.pickup?.location) {
      const p = order.pickup.location;
      doc.text('Pickup Order', leftX, doc.y);
      if (order.userEmail) doc.text(`Customer: ${order.userEmail}`, leftX, doc.y);
    }
    // Right: Restaurant address
    let rightYStart = topY;
    doc.fontSize(12).fillColor('#000').text('Restaurant', midX, rightYStart);
    doc.fontSize(10).fillColor('#333');
    if (order.pickup?.location) {
      const p = order.pickup.location;
      const addr = Array.isArray(p?.address?.streetAddress) ? p.address.streetAddress.join(' ') : '';
      doc.text(`${p.name || 'Restaurant'}`, midX, doc.y);
      doc.text(`${addr} ${p?.address?.city || ''} ${p?.address?.province || ''} ${p?.address?.postalCode || ''}`, midX, doc.y, { width: 240 });
    }
    doc.moveDown(1);

    // Items table header
    doc.fontSize(12).fillColor('#000').text('Items');
    doc.moveDown(0.5);
    const startX = doc.x;
    const colWidths = [280, 80, 100];
    doc.fontSize(10).text('Name', startX, doc.y, { width: colWidths[0] });
    doc.text('Qty', startX + colWidths[0], doc.y, { width: colWidths[1], align: 'right' });
    doc.text('Price', startX + colWidths[0] + colWidths[1], doc.y, { width: colWidths[2], align: 'right' });
    doc.moveDown(0.5);
    doc.moveTo(startX, doc.y).lineTo(startX + colWidths.reduce((a,b)=>a+b,0), doc.y).strokeColor('#ccc').stroke();

    // Items rows
    let itemsSubtotal = 0;
    (Array.isArray(order.items) ? order.items : []).forEach((it) => {
      const price = Number(it.priceCents || 0) * Number(it.quantity || 1) / 100;
      itemsSubtotal += price;
      doc.moveDown(0.2);
      doc.fillColor('#333').text(`${it.name} ${it.size ? '('+it.size+')' : ''}`, startX, doc.y, { width: colWidths[0] });
      doc.text(String(it.quantity || 1), startX + colWidths[0], doc.y, { width: colWidths[1], align: 'right' });
      doc.text(`$${price.toFixed(2)}`, startX + colWidths[0] + colWidths[1], doc.y, { width: colWidths[2], align: 'right' });
    });

    doc.moveDown();
    const delivery = Number(order.deliveryFeeCents || 0) / 100;
    const tip = Number(order.tipCents || 0) / 100;
    const tax = Number(order.taxCents || 0) / 100;
    const grandTotal = Number(order.totalCents || 0) / 100;

    const labelWidth = 200;
    const valueX = startX + colWidths.reduce((a,b)=>a+b,0) - 100;
    function row(label, value) {
      const y = doc.y;
      doc.fillColor('#000').text(label, valueX - labelWidth, y, { width: labelWidth, align: 'right' });
      doc.text(`$${value.toFixed(2)}`, valueX, y, { width: 100, align: 'right' });
      doc.moveDown(0.3);
    }
    row('Items Subtotal', itemsSubtotal);
    row('Tax (5%)', tax);
    row('Tip', tip);
    row('Delivery Fee', delivery);
    doc.moveDown(0.2);
    doc.moveTo(startX, doc.y).lineTo(startX + colWidths.reduce((a,b)=>a+b,0), doc.y).strokeColor('#ccc').stroke();
    doc.moveDown(0.2);
    row('Grand Total', grandTotal);

    // Notes
    if (order.notes) {
      doc.moveDown(0.8);
      doc.fontSize(10).fillColor('#000').text('Notes:', startX, doc.y);
      doc.fontSize(10).fillColor('#333').text(String(order.notes), startX, doc.y, { width: colWidths.reduce((a,b)=>a+b,0) });
    }

    // Footer
    doc.moveDown(1.2);
    doc.fontSize(12).fillColor('#000').text('Thank you, visit again!', { align: 'center' });

    doc.end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

