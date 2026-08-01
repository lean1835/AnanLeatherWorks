import { Document, Types } from 'mongoose';
import type { ICustomer } from './customer.interface';

export type RepairOrderStatus = 'Mới nhận' | 'Đang sửa' | 'Hoàn thành' | 'Đã hủy';

export interface IRepairOrder extends Document {
    _id: Types.ObjectId;
    customerId: Types.ObjectId;
    productName: string;
    receivedAt: Date;
    dueAt: Date;
    status: RepairOrderStatus;
    beforeImages: string[];
    afterImages: string[];
    replacementMaterials: string[];
    tasks: string[];
    note?: string;
    totalAmount: number;
    completedAt?: Date;

    createdAt: Date;
    updatedAt: Date;
}

export interface RepairOrderData {
    _id: Types.ObjectId;
    customerId: Types.ObjectId | ICustomer;
    productName: string;
    receivedAt: Date;
    dueAt: Date;
    status: RepairOrderStatus;
    beforeImages: string[];
    afterImages: string[];
    replacementMaterials: string[];
    tasks: string[];
    note?: string;
    totalAmount: number;
    completedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface CustomerGroupedRepairOrder extends RepairOrderData {
    isRollover: boolean;
    monthsAgo: number;
    isPushedForward: boolean;
    pushedToMonth: number | null;
    pushedToYear: number | null;
}
