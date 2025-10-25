import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
	site: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true, index: true },
	name: { type: String, required: true },
	imageUrl: { type: String, required: true },
	sortIndex: { type: Number, default: 0 },
}, { timestamps: true });

CategorySchema.index({ site: 1, name: 1 }, { unique: true });

export default mongoose.model('Category', CategorySchema);
