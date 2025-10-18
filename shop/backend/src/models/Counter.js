import mongoose from 'mongoose';

// Maintains atomic incrementing counters (e.g., order numbers)
// _id is the counter key (e.g., 'orders' or `orders:<siteId>`)
const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
}, { versionKey: false, timestamps: false });

export default mongoose.model('Counter', CounterSchema);
