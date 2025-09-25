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

		// Theme colors and layout helpers
		const colors = {
			primary: '#2563eb',
			primaryText: '#ffffff',
			text: '#334155',
			textDark: '#0f172a',
			border: '#cbd5e1',
			tableHeader: '#e0f2fe',
			rowStripe: '#f8fafc',
			headHighlight: '#dbeafe',
		};
		const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
		doc.lineWidth(0.5);

		// Header band (colorful)
		const headerY = doc.y;
		doc.save();
		doc.rect(doc.page.margins.left, headerY, availableWidth, 40).fill(colors.primary);
		doc.restore();
		doc.font('Helvetica-Bold').fontSize(22).fillColor(colors.primaryText).text('Order Invoice', doc.page.margins.left + 12, headerY + 10);
		// move the cursor just below the header band
    doc.y = headerY + 52;

		// Two-column block: Customer and Restaurant
		doc.moveDown(0.6);
		const columnGap = 16;
		const columnWidth = (availableWidth - columnGap) / 2;
		const leftX = doc.page.margins.left;
		const rightX = leftX + columnWidth + columnGap;
		const topY = doc.y;
    // Left column: Restaurant first, then Customer
    // Restaurant
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.textDark).text('Restaurant', leftX, topY);
    doc.font('Helvetica').fontSize(10).fillColor(colors.text);
    let cursorLeft = doc.y;
    if (order.pickup?.location) {
      const p = order.pickup.location;
      const addr = Array.isArray(p?.address?.streetAddress) ? p.address.streetAddress.join(' ') : '';
      doc.text(`${p.name || 'Restaurant'}`, leftX, cursorLeft, { width: columnWidth });
      doc.text(`${addr} ${p?.address?.city || ''} ${p?.address?.province || ''} ${p?.address?.postalCode || ''}`, leftX, doc.y, { width: columnWidth });
    }
    // small gap then Customer
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.textDark).text('Customer', leftX, doc.y);
    doc.font('Helvetica').fontSize(10).fillColor(colors.text);
    if (order.dropoff) {
      const d = order.dropoff || {};
      const addr = Array.isArray(d?.address?.streetAddress) ? d.address.streetAddress.join(' ') : '';
      doc.text(`Name: ${d.name || '—'}`, leftX, doc.y, { width: columnWidth });
      doc.text(`Phone: ${d.phone || '—'}`, leftX, doc.y, { width: columnWidth });
      doc.text(`Address: ${addr} ${d?.address?.city || ''} ${d?.address?.province || ''} ${d?.address?.postalCode || ''}`, leftX, doc.y, { width: columnWidth });
    } else if (order.pickup?.location) {
      if (order.userEmail) doc.text(`Customer: ${order.userEmail}`, leftX, doc.y, { width: columnWidth });
    }
    const leftEndY = doc.y;

    // Right column: Order details
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.textDark).text('Order details', rightX, topY);
    doc.font('Helvetica').fontSize(10).fillColor(colors.text);
    doc.text(`Order #: ${String(order._id)}`, rightX, doc.y, { width: columnWidth });
    doc.text(`Date: ${new Date(order.createdAt).toLocaleString()}`, rightX, doc.y, { width: columnWidth });
    doc.text(`Fulfillment: ${order.fulfillmentType || (order.dropoff ? 'delivery' : 'pickup')}`, rightX, doc.y, { width: columnWidth });
    const rightEndY = doc.y;
		// Set cursor to the deeper of the two columns to avoid overlap
		doc.y = Math.max(leftEndY, rightEndY) + 10;
		doc.moveDown(0.2);

		// Items table (centered) helpers
		const colWidths = [260, 60, 85, 90]; // Name, Qty, Unit, Total
		const tableWidth = colWidths.reduce((a, b) => a + b, 0);
		const startX = doc.page.margins.left + (availableWidth - tableWidth) / 2;

    function drawItemsHeader() {
      doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.textDark)
        .text('Order details', startX, doc.y, { width: tableWidth, align: 'center' });
			doc.moveDown(0.4);
			doc.save();
			doc.rect(startX, doc.y - 2, tableWidth, 18).fill(colors.tableHeader);
			doc.restore();
			doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.textDark);
			const headerY = doc.y - 0.5;
			doc.text('Name', startX, headerY, { width: colWidths[0], align: 'center' });
			doc.text('Qty', startX + colWidths[0], headerY, { width: colWidths[1], align: 'center' });
			doc.text('Unit', startX + colWidths[0] + colWidths[1], headerY, { width: colWidths[2], align: 'center' });
			doc.text('Total', startX + colWidths[0] + colWidths[1] + colWidths[2], headerY, { width: colWidths[3], align: 'center' });
			doc.moveDown(1);
			doc.moveTo(startX, doc.y).lineTo(startX + tableWidth, doc.y).strokeColor(colors.border).stroke();
		}

		const pageBottom = doc.page.height - doc.page.margins.bottom;
		function ensureRowSpace() {
			if (doc.y + 22 > pageBottom) {
				doc.addPage();
				drawItemsHeader();
			}
		}

		drawItemsHeader();

		// Items rows
		let itemsSubtotal = 0;
		(Array.isArray(order.items) ? order.items : []).forEach((it, idx) => {
			ensureRowSpace();
			const unit = Number(it.priceCents || 0) / 100;
			const qty = Number(it.quantity || 1);
			const line = unit * qty;
			itemsSubtotal += line;

			// zebra background for readability
			doc.save();
			if (idx % 2 === 0) {
				doc.rect(startX, doc.y - 2, tableWidth, 18).fill(colors.rowStripe);
			}
			doc.restore();

			const rowY = doc.y;
			doc.font('Helvetica').fillColor(colors.text)
				.text(`${it.name} ${it.size ? '(' + it.size + ')' : ''}`, startX, rowY, { width: colWidths[0], align: 'center' });
			doc.text(String(qty), startX + colWidths[0], rowY, { width: colWidths[1], align: 'center' });
			doc.text(`$${unit.toFixed(2)}`, startX + colWidths[0] + colWidths[1], rowY, { width: colWidths[2], align: 'center' });
			doc.text(`$${line.toFixed(2)}`, startX + colWidths[0] + colWidths[1] + colWidths[2], rowY, { width: colWidths[3], align: 'center' });

			doc.moveDown(0.4);
			doc.moveTo(startX, doc.y).lineTo(startX + tableWidth, doc.y).strokeColor(colors.border).stroke();
		});

		doc.moveDown();
		if (doc.y + 90 > pageBottom) {
			doc.addPage();
		}
    const delivery = Number(order.deliveryFeeCents || 0) / 100;
    const tax = Number(order.taxCents || 0) / 100;
    const tip = Number(order.tipCents || 0) / 100;
    const grandTotal = Number(order.totalCents || 0) / 100;
    const coupon = order.meta?.coupon;

		const labelWidth = 220;
		const valueX = startX + tableWidth - 100;
		// Border box for totals
		doc.save();
		doc.roundedRect(startX, doc.y - 4, tableWidth, 80, 6).strokeColor(colors.border).stroke();
		doc.restore();
		function row(label, value) {
      const y = doc.y;
			doc.font('Helvetica').fillColor(colors.textDark).text(label, valueX - labelWidth, y, { width: labelWidth, align: 'right' });
			doc.text(`$${(Number(value)||0).toFixed(2)}`, valueX, y, { width: 100, align: 'right' });
      doc.moveDown(0.3);
    }
    row('Items Subtotal', itemsSubtotal);
    if (coupon && typeof coupon.percent === 'number') {
      const discount = itemsSubtotal * (Number(coupon.percent) / 100);
      row(`Coupon ${coupon.code ? '('+coupon.code+')' : ''} (-${coupon.percent}% )`, -discount);
    }
    const taxRatePct = itemsSubtotal > 0 ? Math.round((tax / itemsSubtotal) * 1000) / 10 : null;
    row(`Tax${taxRatePct !== null ? ` (${taxRatePct}% )` : ''}`, tax);
    if (tip > 0) row('Tip', tip);
    if (delivery > 0) row('Delivery Fee', delivery);
    doc.moveDown(0.2);
		doc.moveTo(startX, doc.y).lineTo(startX + tableWidth, doc.y).strokeColor(colors.border).stroke();
    doc.moveDown(0.2);
		doc.font('Helvetica-Bold');
    row('Grand Total', grandTotal);

		// Notes
    if (order.notes) {
      doc.moveDown(0.8);
			doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.textDark).text('Notes:', startX, doc.y);
			doc.font('Helvetica').fontSize(10).fillColor(colors.text).text(String(order.notes), startX, doc.y, { width: tableWidth });
    }

		// Footer
    doc.moveDown(1.2);
		doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.textDark).text('Thank you for your order!', { align: 'center' });

    doc.end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

