import nodemailer from 'nodemailer';

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    // Return a dummy transporter that logs instead of sending
    return {
      sendMail: async (opts) => {
        console.log('[mailer] SMTP not configured. Would send:', opts);
      },
    };
  }
  const secure = port === 465; // 465 = SSL, 587 = STARTTLS
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return cachedTransporter;
}

export async function sendOrderEmail({ to, siteName, orderId, items, totalCents, deliveryFeeCents = 0, fulfillmentType = 'pickup', trackingUrl = '' }) {
  try {
    if (!to) return;
    const from = process.env.SMTP_FROM || 'orders@blueboxx.ca';
    const subject = `Your ${siteName || 'Order'} is confirmed (#${String(orderId).slice(-6)})`;
    const money = (cents) => `$${((Number(cents) || 0) / 100).toFixed(2)}`;
    const itemsHtml = (Array.isArray(items) ? items : []).map(it => `
      <tr>
        <td style="padding:6px 8px; border-bottom:1px solid #eee;">${it.name}${it.size ? ` (${it.size})` : ''}${it.spiceLevel ? ` [${it.spiceLevel}]` : ''}</td>
        <td style="padding:6px 8px; text-align:center; border-bottom:1px solid #eee;">${it.quantity}</td>
        <td style="padding:6px 8px; text-align:right; border-bottom:1px solid #eee;">${money(it.priceCents)}</td>
      </tr>
    `).join('');
    const html = `
      <div style="font-family:Arial, Helvetica, sans-serif; color:#0f172a;">
        <h2 style="margin-bottom:6px;">Thanks for your order!</h2>
        <div style="color:#334155; margin-bottom:12px;">Order <strong>#${String(orderId).slice(-6)}</strong> at <strong>${siteName || ''}</strong> has been confirmed.</div>
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left; padding:6px 8px; border-bottom:1px solid #ddd;">Item</th>
              <th style="text-align:center; padding:6px 8px; border-bottom:1px solid #ddd;">Qty</th>
              <th style="text-align:right; padding:6px 8px; border-bottom:1px solid #ddd;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div style="margin-top:10px; text-align:right;">
          ${deliveryFeeCents ? `<div style=\"color:#334155;\">Delivery fee: <strong>${money(deliveryFeeCents)}</strong></div>` : ''}
          <div style="font-size:18px; color:#1d4ed8;">Total paid: <strong>${money(totalCents)}</strong></div>
        </div>
        ${trackingUrl ? `<div style=\"margin-top:12px;\">Track delivery: <a href=\"${trackingUrl}\">${trackingUrl}</a></div>` : ''}
        <div style="margin-top:16px; color:#64748b; font-size:12px;">If you have any questions, reply to this email.</div>
      </div>
    `;
    const transporter = getTransporter();
    await transporter.sendMail({ from, to, subject, html });
  } catch (err) {
    console.error('[mailer] Failed to send email', err);
  }
}
