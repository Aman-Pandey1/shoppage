import dotenv from 'dotenv';
import { sendOrderEmail } from '../utils/mailer.js';

dotenv.config();

async function main() {
  try {
    const to = process.argv[2] || process.env.TEST_EMAIL_TO || process.env.ADMIN_EMAIL || process.env.SMTP_USER;
    if (!to) {
      console.error('Provide a recipient email: npm run email:test -- you@example.com');
      process.exit(1);
    }
    const siteName = process.env.SITE_NAME || 'BlueBoxx';
    const orderId = `test-${Date.now()}`;
    const items = [{ name: 'Test Item', quantity: 1, priceCents: 199 }];
    const totalCents = items.reduce((sum, it) => sum + Number(it.priceCents || 0) * Number(it.quantity || 1), 0);

    await sendOrderEmail({
      to,
      siteName,
      orderId,
      items,
      totalCents,
      deliveryFeeCents: 0,
      fulfillmentType: 'pickup',
      trackingUrl: ''
    });
    console.log(`[email:test] Sent test order email to ${to}`);
  } catch (err) {
    console.error('[email:test] Failed to send test email:', err);
    process.exit(1);
  }
}

main();
