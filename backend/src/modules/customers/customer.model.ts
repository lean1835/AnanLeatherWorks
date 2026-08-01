import mongoose, { Schema } from 'mongoose';
import { ICustomer } from '@common/interfaces/customer.interface';

const CustomerSchema: Schema = new Schema(
    {
        fullName: { type: String, required: true, trim: true },
        phone: { type: String, required: true, trim: true },
        normalizedPhone: { type: String, required: true, trim: true },
        email: { type: String, default: '', trim: true },
        dateOfBirth: { type: Date, default: null },
        note: { type: String, default: '', trim: true },
    },
    { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } },
);

CustomerSchema.index({ normalizedPhone: 1 }, { name: 'idx_customer_normalizedPhone', unique: true });

export default mongoose.model<ICustomer>('Customer', CustomerSchema);
