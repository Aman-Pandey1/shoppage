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
    items: [OrderItemSchema],
    totalCents: { type: Number, required: true },
    tipCents: { type: Number, default: 0 },
    externalId: { type: String },
    uberDeliveryId: { type: String },
    status: { type: String, default: 'created' },
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
}, { timestamps: true });

export default mongoose.model('Order', OrderSchema);

