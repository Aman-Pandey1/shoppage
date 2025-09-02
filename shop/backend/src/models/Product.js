import mongoose from 'mongoose';

const OptionSchema = new mongoose.Schema({
	key: { type: String, required: true },
	label: { type: String, required: true },
	priceDelta: { type: Number, default: 0 },
}, { _id: false });

const ProductSchema = new mongoose.Schema({
	name: { type: String, required: true },
	description: { type: String },
	imageUrl: { type: String },
	price: { type: Number, required: true },
	categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
	spiceLevels: [{ type: String }],
	extraOptionGroups: [{
		groupKey: { type: String, required: true },
		groupLabel: { type: String, required: true },
		minSelect: { type: Number, default: 0 },
		maxSelect: { type: Number, default: 0 },
		options: [OptionSchema],
	}],
}, { timestamps: true });

export default mongoose.model('Product', ProductSchema);
