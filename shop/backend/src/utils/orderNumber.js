import Counter from '../models/Counter.js';

const DEFAULT_PREFIX = 'BB-';
const DEFAULT_START = Number(process.env.ORDER_NUMBER_START || 1001);

// Generate the next order number like "BB-1001". By default global sequence.
export async function getNextOrderNumber(siteId) {
  const key = process.env.ORDER_NUMBER_SCOPE === 'per_site' && siteId ? `order:${siteId}` : 'order';
  // Ensure first increment yields DEFAULT_START using $setOnInsert
  const startBase = Math.max(0, Number(DEFAULT_START) - 1);
  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  // Normalize prefix: ensure a trailing hyphen so format is e.g., "BB-1001"
  const rawPrefix = process.env.ORDER_NUMBER_PREFIX || DEFAULT_PREFIX;
  const prefix = String(rawPrefix).endsWith('-') ? String(rawPrefix) : `${String(rawPrefix)}-`;
  const seqOffset = Number(doc?.seq || 1);
  const seq = startBase + seqOffset;
  return `${prefix}${seq}`;
}
