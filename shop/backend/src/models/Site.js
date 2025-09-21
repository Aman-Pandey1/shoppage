import mongoose from 'mongoose';

const SiteSchema = new mongoose.Schema({
	name: { type: String, required: true },
	slug: { type: String, required: true, unique: true, index: true },
	domains: [{ type: String }],
	isActive: { type: Boolean, default: true },
	brandColor: { type: String, default: '#0ea5e9' },
	uberCustomerId: { type: String },
	// New: support multiple pickup locations for a site while keeping legacy `pickup`
	locations: [{
		name: { type: String },
		phone: { type: String },
		address: {
			streetAddress: [{ type: String }],
			city: { type: String },
			province: { type: String },
			postalCode: { type: String },
			country: { type: String, default: 'CA' },
		},
	}],
	// Optional: cities for delivery selection (distinct from addresses)
	cities: [{ type: String }],
	pickup: {
		name: { type: String },
		phone: { type: String },
		address: {
			streetAddress: [{ type: String }],
			city: { type: String },
			province: { type: String },
			postalCode: { type: String },
			country: { type: String, default: 'CA' },
		},
	},
}, { timestamps: true });

export default mongoose.model('Site', SiteSchema);

