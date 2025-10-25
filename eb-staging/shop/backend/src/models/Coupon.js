import mongoose from 'mongoose';

const CouponSchema = new mongoose.Schema({
  site: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true, index: true },
  code: { type: String, required: true },
  percent: { type: Number, required: true, min: 0, max: 100 },
}, { timestamps: true });

CouponSchema.index({ site: 1, code: 1 }, { unique: true });

export default mongoose.model('Coupon', CouponSchema);

