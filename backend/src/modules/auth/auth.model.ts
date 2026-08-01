import mongoose, { Schema } from 'mongoose';
import { IUser } from '@common/interfaces/user.interface';

const UserSchema: Schema = new Schema(
    {
        username: { type: String, required: true, trim: true, lowercase: true },
        passwordHash: { type: String, required: true, select: false },
        displayName: { type: String, required: true, trim: true },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } },
);

UserSchema.index({ username: 1 }, { name: 'idx_user_username', unique: true });

export default mongoose.model<IUser>('User', UserSchema);
