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
    // Product variants treated as optional add-ons.
    // `price` here represents an add-on price that is added to the base product price
    // only when the variant is selected by the user.
    variants: [{
        key: { type: String, required: true },
        label: { type: String, required: true },
        price: { type: Number, default: 0 },
    }],
	// Optional: flavors (like sauces/tastes) with per-item add-on price
	flavors: [{
		key: { type: String, required: true },
		label: { type: String, required: true },
		price: { type: Number, default: 0 },
	}],
	// Optional: portions (e.g., Half / Full) with per-item price delta
	portions: [{
		key: { type: String, required: true },
		label: { type: String, required: true },
		price: { type: Number, default: 0 },
	}],
	// Optional: quantities (e.g., 250g / 500g / 1kg) with per-item price delta
	quantities: [{
		key: { type: String, required: true },
		label: { type: String, required: true },
		price: { type: Number, default: 0 },
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
