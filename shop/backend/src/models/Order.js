import mongoose from 'mongoose';

const OrderItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    priceCents: { type: Number, required: true },
    size: { type: String },
}, { _id: false });

const OrderSchema = new mongoose.Schema({
    site: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    userEmail: { type: String },
    fulfillmentType: { type: String, enum: ['pickup', 'delivery', 'created'], default: 'created' },
    items: [OrderItemSchema],
    totalCents: { type: Number, required: true },
    // 5% tax on items subtotal
    taxCents: { type: Number, default: 0 },
    // Tip removed from system; keep field for backward compatibility set to 0
    tipCents: { type: Number, default: 0, select: true },
    deliveryFeeCents: { type: Number, default: 0 },
    // Freeform notes from customer to restaurant (e.g., extra spicy, no onions)
    notes: { type: String },
    externalId: { type: String },
    uberDeliveryId: { type: String },
    uberTrackingUrl: { type: String },
    uberStatus: { type: String },
    status: { type: String, default: 'created' },
    pickup: {
        location: {
            name: String,
            phone: String,
            address: {
                streetAddress: [String],
                city: String,
                province: String,
                postalCode: String,
                country: String,
            },
        },
        scheduledFor: { type: Date },
    },
    dropoff: {
        name: String,
        phone: String,
        address: {
            streetAddress: [String],
            city: String,
            province: String,
            postalCode: String,
            country: String,
        },
    },
    // Arbitrary metadata (e.g., distanceKm)
    meta: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

export default mongoose.model('Order', OrderSchema);

