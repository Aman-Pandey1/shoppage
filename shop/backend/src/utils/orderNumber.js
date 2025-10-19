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
    { $inc: { seq: 1 }, $setOnInsert: { seq: startBase } },
    { new: true, upsert: true }
  );
  const seq = Number(doc?.seq || DEFAULT_START);
  // Normalize prefix to guarantee format like "BB-1001"
  const raw = String(process.env.ORDER_NUMBER_PREFIX || DEFAULT_PREFIX).trim();
  let prefix = raw.replace(/\s+/g, '');
  // Remove any trailing dashes so we don't end up with double dashes
  prefix = prefix.replace(/-+$/g, '');
  // Uppercase alphabetic prefixes for consistency (BB, INV, etc.)
  prefix = prefix.toUpperCase();
  // Always ensure a single dash between prefix and sequence
  prefix = `${prefix}-`;
  return `${prefix}${seq}`;
}
