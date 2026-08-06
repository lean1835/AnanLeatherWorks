import { Document, Types } from 'mongoose';
import type { ICustomer } from './customer.interface';

export type RepairOrderStatus = 'Đang sửa' | 'Hoàn thành' | 'Đã thanh toán';

export interface IRepairOrder extends Document {
    _id: Types.ObjectId;
    customerId: Types.ObjectId;
    productName: string;
    receivedAt: Date;
    dueAt: Date;
    status: RepairOrderStatus;
    images: string[];
    replacementMaterials: string[];
    tasks: string[];
    note?: string;
    totalAmount: number;
    completedAt?: Date;
    deletedAt?: Date | null;

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
    images: string[];
    replacementMaterials: string[];
    tasks: string[];
    note?: string;
    totalAmount: number;
    completedAt?: Date;
    deletedAt?: Date | null;
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

export interface IRepairOrderTrashItem extends RepairOrderData {
    deletedAt: Date;
    daysRemaining: number;
}
