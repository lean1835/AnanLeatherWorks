import { Document, Types } from 'mongoose';

export interface ICustomer extends Document {
    _id: Types.ObjectId;
    fullName: string;
    phone: string;
    normalizedPhone: string;
    email?: string;
    dateOfBirth?: Date | string;
    note?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ICustomerPayload {
    fullName: string;
    phone: string;
    email?: string;
    dateOfBirth?: Date | string;
    note?: string;
}
