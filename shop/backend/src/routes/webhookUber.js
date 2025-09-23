import { Router } from 'express';
import crypto from 'crypto';
import Order from '../models/Order.js';

// This router expects raw body. Mount with express.raw({ type: '*/*' })
const router = Router();

function verifySignature(rawBodyBuffer, signatureHeader, signingKey) {
  if (!signingKey) return true; // allow in non-prod if key not set
  if (!rawBodyBuffer || !signatureHeader) return false;
  try {
    const expected = crypto
      .createHmac('sha256', signingKey)
      .update(rawBodyBuffer)
      .digest('hex');
    const provided = String(signatureHeader).trim();
    // Constant-time compare
    if (expected.length !== provided.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) {
      mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
    }
    return mismatch === 0;
  } catch {
    return false;
  }
}

router.get('/', (_req, res) => {
  res.json({ ok: true });
});

router.post('/', async (req, res) => {
  try {
    const signingKey = process.env.UBER_SIGNING_KEY || process.env.UBER_WEBHOOK_SECRET;
    const sig = req.get('X-Uber-Signature') || req.get('x-uber-signature') || req.get('x-uber-signature-sha256');
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    const valid = verifySignature(raw, sig, signingKey);
    if (!valid) return res.status(400).json({ ok: false, error: 'Invalid signature' });

    const text = raw.toString('utf8') || '{}';
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (e) {
      return res.status(400).json({ ok: false, error: 'Invalid JSON' });
    }

    // Normalize event shape. Uber may send {event_type, resource_type, data}
    const eventType = payload.event_type || payload.type || payload.event || '';
    const data = payload.data || payload.resource || payload || {};

    // Extract delivery identifiers and status/url
    const deliveryId = data.delivery_id || data.id || data.deliveryId || data.resource_id || '';
    const externalId = data.external_id || data.external_delivery_id || '';
    const trackingUrl = data.tracking_url || data.trackingUrl || data.share_url || '';
    const status = data.status || data.state || data.current_status || data.new_status || '';

    // Update order if possible
    if (deliveryId || externalId) {
      const query = deliveryId ? { uberDeliveryId: String(deliveryId) } : { externalId: String(externalId) };
      const updates = {};
      if (trackingUrl) updates.uberTrackingUrl = trackingUrl;
      if (status) updates.uberStatus = status;
      if (Object.keys(updates).length) {
        try {
          await Order.updateMany(query, { $set: updates });
        } catch {}
      }
    }

    res.json({ ok: true, received: true, eventType });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

export default router;

