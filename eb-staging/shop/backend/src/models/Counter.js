import mongoose from 'mongoose';

// Maintains atomic incrementing counters (e.g., order numbers)
// _id is the counter key (e.g., 'orders' or `orders:<siteId>`)
const defaultStart = Number(process.env.ORDER_NUMBER_START || 1001);
// `seq` stores the running count; we start at 0 so first $inc yields 1
const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0, min: 0 },
}, { versionKey: false, timestamps: false });

export default mongoose.model('Counter', CounterSchema);
