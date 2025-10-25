import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String },
    passwordHash: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model('User', UserSchema);

