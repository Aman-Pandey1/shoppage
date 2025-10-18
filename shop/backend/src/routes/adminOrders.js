import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import Order from '../models/Order.js';
import Site from '../models/Site.js';
import PDFDocument from 'pdfkit';
import { formatDateTimeInSiteTz } from '../utils/time.js';

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
			// Only show orders that are actually placed/paid
			list = list.filter((o) => (o.status === 'paid' || o.status === 'confirmed'));
			if (fromDate) list = list.filter((o) => new Date(o.createdAt) >= fromDate);
			if (toDate) list = list.filter((o) => new Date(o.createdAt) <= toDate);
			list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
			return res.json(list);
		}

		const filter = { site: siteId, status: { $in: ['paid', 'confirmed'] } };
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
    const fileId = (order.orderNumber || String(order._id).slice(-6)).replace(/\s+/g, '');
    res.setHeader('Content-Disposition', `attachment; filename=order-${fileId}.pdf`);

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
    doc.font('Helvetica-Bold').fontSize(22).fillColor(colors.primaryText).text('ORDER INVOICE', doc.page.margins.left + 12, headerY + 10);
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
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.textDark).text('RESTAURANT ADDRESS', leftX, topY);
    doc.font('Helvetica').fontSize(10).fillColor(colors.text);
    let cursorLeft = doc.y;
    if (order.pickup?.location) {
      const p = order.pickup.location;
      const addr = Array.isArray(p?.address?.streetAddress) ? p.address.streetAddress.join(' ') : '';
      doc.text(`${p.name || 'Restaurant'}`, leftX, cursorLeft, { width: columnWidth });
      doc.text(`Address: ${addr} ${p?.address?.city || ''} ${p?.address?.province || ''} ${p?.address?.postalCode || ''}`, leftX, doc.y, { width: columnWidth });
    }
    // small gap then Customer
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.textDark).text('CUSTOMER ADDRESS', leftX, doc.y);
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

    // Right column: Order/Delivery details
    const detailsHeader = 'ORDER DETAIL';
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.textDark).text(detailsHeader, rightX, topY);
    doc.font('Helvetica').fontSize(10).fillColor(colors.text);
    doc.text(`Order #: ${order.orderNumber || String(order._id)}`, rightX, doc.y, { width: columnWidth });
    let siteLike = null;
    if (mock) {
      siteLike = (mock.sites || []).find((s) => String(s._id) === String(siteId));
    } else {
      try { siteLike = await Site.findById(siteId); } catch {}
    }
    doc.text(`Date: ${formatDateTimeInSiteTz(order.createdAt, siteLike)}`, rightX, doc.y, { width: columnWidth });
    const fulfillmentUpper = String(order.fulfillmentType || (order.dropoff ? 'delivery' : 'pickup')).toUpperCase();
    doc.text(`Fulfillment: ${fulfillmentUpper}`, rightX, doc.y, { width: columnWidth });
    const rightEndY = doc.y;
		// Set cursor to the deeper of the two columns to avoid overlap
		doc.y = Math.max(leftEndY, rightEndY) + 10;
		doc.moveDown(0.2);

		// Items list (no table) with aligned prices on the right
		const listX = doc.page.margins.left + 20;
		const listWidth = availableWidth - 40;
		const priceColWidth = 100;
		// Define commonly used layout anchors for totals/lines below
		const startX = listX;
		const tableWidth = listWidth;

		function drawSectionTitle() {
			doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.textDark)
				.text('ORDER SUMMARY', listX, doc.y, { width: listWidth, align: 'center' });
			doc.moveDown(0.6);
		}

		const pageBottom = doc.page.height - doc.page.margins.bottom;
		function ensureRowSpace() {
			if (doc.y + 20 > pageBottom) {
				doc.addPage();
				drawSectionTitle();
			}
		}

		drawSectionTitle();

		let itemsSubtotal = 0;
		(Array.isArray(order.items) ? order.items : []).forEach((it, idx) => {
			ensureRowSpace();
			const unit = Number(it.priceCents || 0) / 100;
			const qty = Number(it.quantity || 1);
			const line = unit * qty;
			itemsSubtotal += line;

      // simplified rows without shaded backgrounds

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
		if (doc.y + 90 > pageBottom) {
			doc.addPage();
		}
    const delivery = Number(order.deliveryFeeCents || 0) / 100;
    const deliveryRestaurant = Number(order.deliveryFeeRestaurantCents || 0) / 100;
    const tax = Number(order.taxCents || 0) / 100;
    const tip = Number(order.tipCents || 0) / 100;
    const grandTotal = Number(order.totalCents || 0) / 100;
    const coupon = order.meta?.coupon;

		const labelWidth = 220;
		const valueX = listX + listWidth - 100;
    // Simple totals area without a rounded box for a cleaner look
    function row(label, value) {
      const y = doc.y;
			doc.font('Helvetica').fillColor(colors.textDark).text(label, valueX - labelWidth, y, { width: labelWidth, align: 'right' });
			doc.text(`$${(Number(value)||0).toFixed(2)}`, valueX, y, { width: 100, align: 'right' });
      doc.moveDown(0.3);
    }
    row('ITEMS SUBTOTAL', itemsSubtotal);
    // Compute discount from totals so it shows even without coupon metadata
    const itemsAfterDiscount = Math.max(0, grandTotal - tax - (delivery > 0 ? delivery : 0) - (tip > 0 ? tip : 0));
    const computedDiscount = Math.max(0, itemsSubtotal - itemsAfterDiscount);
    if (computedDiscount > 0.0001) {
      const discountLabel = (coupon && typeof coupon.percent === 'number')
        ? `DISCOUNT ${coupon.code ? '('+coupon.code+')' : ''} (-${coupon.percent}% )`
        : 'DISCOUNT';
      row(discountLabel, -computedDiscount);
    }
    // Always display fixed 5% tax label to match checkout
    row('TAX (5%)', tax);
    if (tip > 0) row('TIP', tip);
    if (delivery > 0) {
      if (deliveryRestaurant > 0) {
        row('DELIVERY CHARGE (RESTAURANT)', deliveryRestaurant);
        row('DELIVERY CHARGE (CUSTOMER)', delivery);
      } else {
        row('DELIVERY CHARGE', delivery);
      }
    }
    doc.moveDown(0.2);
			doc.moveTo(startX, doc.y).lineTo(startX + tableWidth, doc.y).strokeColor(colors.border).stroke();
    doc.moveDown(0.2);
		doc.font('Helvetica-Bold');
    row('TOTAL', grandTotal);

		// Notes
    if (order.notes) {
      doc.moveDown(0.8);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.textDark).text('NOTES:', startX, doc.y);
			doc.font('Helvetica').fontSize(10).fillColor(colors.text).text(String(order.notes), startX, doc.y, { width: tableWidth });
    }

		// Footer
      doc.moveDown(1.2);
      doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.textDark)
        .text('THANK YOU FOR YOUR ORDER!', doc.page.margins.left, doc.y, { width: availableWidth, align: 'center', lineBreak: false });

    doc.end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

