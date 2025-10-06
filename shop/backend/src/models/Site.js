import mongoose from 'mongoose';

const SiteSchema = new mongoose.Schema({
	name: { type: String, required: true },
	slug: { type: String, required: true, unique: true, index: true },
	domains: [{ type: String }],
	isActive: { type: Boolean, default: true },
	brandColor: { type: String, default: '#0ea5e9' },
	// Optional logo URL displayed in the shop header
	logoUrl: { type: String },
	// Stripe Connect: connected account for this site (acct_...)
	stripeAccountId: { type: String },
	uberCustomerId: { type: String },
	// Which delivery provider to use for this site: 'uber' or 'doordash'
	deliveryProvider: { type: String, enum: ['uber', 'doordash'], default: 'uber' },
	// DoorDash Drive configuration per site (non-secret identifiers)
	doordashStoreId: { type: String },
	// Flat delivery fee in cents applied to delivery orders only
	deliveryFeeCents: { type: Number, default: 0 },
	// When true, split delivery fee 50/50 between customer and restaurant
	splitDeliveryFee: { type: Boolean, default: false },
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
	// Opening hours configuration per day of week (24h "HH:mm" strings). If omitted, UI will default to 10:00-22:00.
	hours: {
		mon: { open: { type: String, default: '10:00' }, close: { type: String, default: '22:00' }, closed: { type: Boolean, default: false } },
		tue: { open: { type: String, default: '10:00' }, close: { type: String, default: '22:00' }, closed: { type: Boolean, default: false } },
		wed: { open: { type: String, default: '10:00' }, close: { type: String, default: '22:00' }, closed: { type: Boolean, default: false } },
		thu: { open: { type: String, default: '10:00' }, close: { type: String, default: '22:00' }, closed: { type: Boolean, default: false } },
		fri: { open: { type: String, default: '10:00' }, close: { type: String, default: '22:00' }, closed: { type: Boolean, default: false } },
		sat: { open: { type: String, default: '10:00' }, close: { type: String, default: '22:00' }, closed: { type: Boolean, default: false } },
		sun: { open: { type: String, default: '10:00' }, close: { type: String, default: '22:00' }, closed: { type: Boolean, default: false } },
	},
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

