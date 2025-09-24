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

    // Header band
    doc.save();
    doc.rect(doc.page.margins.left, doc.y, doc.page.width - doc.page.margins.left - doc.page.margins.right, 28)
      .fill('#f3f4f6');
    doc.restore();
    doc.moveDown(-0.8);
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#111827').text('Order Invoice', { align: 'left' });
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(10).fillColor('#374151').text(`Order #: ${String(order._id)}`);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleString()}`);
    doc.text(`Fulfillment: ${order.fulfillmentType || (order.dropoff ? 'delivery' : 'pickup')}`);

    // Two-column block: Customer and Restaurant
    doc.moveDown(0.8);
    const leftX = doc.x;
    const midX = leftX + 250;
    const topY = doc.y;
    // Left: Customer
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text('Customer', leftX, topY);
    doc.font('Helvetica').fontSize(10).fillColor('#374151');
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
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text('Restaurant', midX, rightYStart);
    doc.font('Helvetica').fontSize(10).fillColor('#374151');
    if (order.pickup?.location) {
      const p = order.pickup.location;
      const addr = Array.isArray(p?.address?.streetAddress) ? p.address.streetAddress.join(' ') : '';
      doc.text(`${p.name || 'Restaurant'}`, midX, doc.y);
      doc.text(`${addr} ${p?.address?.city || ''} ${p?.address?.province || ''} ${p?.address?.postalCode || ''}`, midX, doc.y, { width: 240 });
    }
    doc.moveDown(1);

    // Items table header
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text('Items');
    doc.moveDown(0.4);
    const startX = doc.x;
    const colWidths = [240, 60, 90, 100]; // Name, Qty, Unit, Total
    const tableWidth = colWidths.reduce((a,b)=>a+b,0);
    doc.save();
    doc.rect(startX, doc.y - 2, tableWidth, 18).fill('#f9fafb');
    doc.restore();
    doc.font('Helvetica-Bold').fontSize(10);
    const headerY = doc.y - 0.5;
    doc.text('Name', startX + 6, headerY, { width: colWidths[0]-12 });
    doc.text('Qty', startX + colWidths[0], headerY, { width: colWidths[1], align: 'right' });
    doc.text('Unit', startX + colWidths[0] + colWidths[1], headerY, { width: colWidths[2], align: 'right' });
    doc.text('Total', startX + colWidths[0] + colWidths[1] + colWidths[2], headerY, { width: colWidths[3], align: 'right' });
    doc.moveDown(1);
    doc.moveTo(startX, doc.y).lineTo(startX + tableWidth, doc.y).strokeColor('#e5e7eb').stroke();

    // Items rows
    let itemsSubtotal = 0;
    (Array.isArray(order.items) ? order.items : []).forEach((it) => {
      const unit = Number(it.priceCents || 0) / 100;
      const qty = Number(it.quantity || 1);
      const line = unit * qty;
      itemsSubtotal += line;
      doc.moveDown(0.2);
      doc.font('Helvetica').fillColor('#374151').text(`${it.name} ${it.size ? '('+it.size+')' : ''}`, startX, doc.y, { width: colWidths[0] });
      doc.text(String(qty), startX + colWidths[0], doc.y, { width: colWidths[1], align: 'right' });
      doc.text(`$${unit.toFixed(2)}`, startX + colWidths[0] + colWidths[1], doc.y, { width: colWidths[2], align: 'right' });
      doc.text(`$${line.toFixed(2)}`, startX + colWidths[0] + colWidths[1] + colWidths[2], doc.y, { width: colWidths[3], align: 'right' });
    });

    doc.moveDown();
    const delivery = Number(order.deliveryFeeCents || 0) / 100;
    const tax = Number(order.taxCents || 0) / 100;
    const tip = Number(order.tipCents || 0) / 100;
    const grandTotal = Number(order.totalCents || 0) / 100;

    const labelWidth = 220;
    const valueX = startX + tableWidth - 100;
    function row(label, value) {
      const y = doc.y;
      doc.font('Helvetica').fillColor('#111827').text(label, valueX - labelWidth, y, { width: labelWidth, align: 'right' });
      doc.text(`$${(Number(value)||0).toFixed(2)}`, valueX, y, { width: 100, align: 'right' });
      doc.moveDown(0.3);
    }
    row('Items Subtotal', itemsSubtotal);
    const taxRatePct = itemsSubtotal > 0 ? Math.round((tax / itemsSubtotal) * 1000) / 10 : null;
    row(`Tax${taxRatePct !== null ? ` (${taxRatePct}% )` : ''}`, tax);
    if (tip > 0) row('Tip', tip);
    if (delivery > 0) row('Delivery Fee', delivery);
    doc.moveDown(0.2);
    doc.moveTo(startX, doc.y).lineTo(startX + tableWidth, doc.y).strokeColor('#d1d5db').stroke();
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold');
    row('Grand Total', grandTotal);

    // Notes
    if (order.notes) {
      doc.moveDown(0.8);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('Notes:', startX, doc.y);
      doc.font('Helvetica').fontSize(10).fillColor('#374151').text(String(order.notes), startX, doc.y, { width: tableWidth });
    }

    // Footer
    doc.moveDown(1.2);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text('Thank you for your order!', { align: 'center' });

    doc.end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

