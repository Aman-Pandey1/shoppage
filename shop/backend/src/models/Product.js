import mongoose from 'mongoose';

const OptionSchema = new mongoose.Schema({
	key: { type: String, required: true },
	label: { type: String, required: true },
	priceDelta: { type: Number, default: 0 },
}, { _id: false });

const ProductSchema = new mongoose.Schema({
	site: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true, index: true },
	name: { type: String, required: true },
	description: { type: String },
	imageUrl: { type: String },
	price: { type: Number, required: true },
	categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
	isVeg: { type: Boolean, default: true },
	spiceLevels: [{ type: String }],
    // Product variants (e.g., sizes).
    // If `price` is provided it is treated as the absolute unit price for the variant.
    // Otherwise `priceDelta` is added on top of the base `price`.
    variants: [{
        key: { type: String, required: true },
        label: { type: String, required: true },
        price: { type: Number },
        priceDelta: { type: Number, default: 0 },
    }],
	extraOptionGroups: [{
		groupKey: { type: String, required: true },
		groupLabel: { type: String, required: true },
		minSelect: { type: Number, default: 0 },
		maxSelect: { type: Number, default: 0 },
		options: [OptionSchema],
	}],
}, { timestamps: true });

ProductSchema.index({ site: 1, categoryId: 1, name: 1 });

export default mongoose.model('Product', ProductSchema);
