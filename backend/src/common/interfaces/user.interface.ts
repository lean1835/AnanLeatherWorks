import { Document, Types } from 'mongoose';

export interface IUser extends Document {
    _id: Types.ObjectId;
    username: string;
    passwordHash: string;
    displayName: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
