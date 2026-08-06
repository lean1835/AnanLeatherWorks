import mongoose, { Schema } from 'mongoose';
import { IRepairOrder, RepairOrderStatus } from '@common/interfaces/repairOrder.interface';
import { getVietnamMonthYear, vietnamEndOfMonthUtc } from '@common/utils/timezone';

export { RepairOrderStatus };

const RepairOrderSchema: Schema = new Schema(
    {
        customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
        productName: { type: String, required: true, trim: true },
        receivedAt: { type: Date, default: Date.now },
        dueAt: {
            type: Date,
            default: function (this: { receivedAt?: Date }) {
                const d = this.receivedAt ? new Date(this.receivedAt) : new Date();
                const period = getVietnamMonthYear(d);
                return vietnamEndOfMonthUtc(period.year, period.month);
            },
        },
        status: {
            type: String,
            enum: ['Đang sửa', 'Hoàn thành', 'Đã thanh toán'],
            default: 'Đang sửa',
        },
        images: {
            type: [{ type: String }],
            default: [],
        },
        replacementMaterials: [{ type: String, trim: true }],
        tasks: [{ type: String, trim: true }],
        note: { type: String, default: '', trim: true },
        totalAmount: { type: Number, default: 0, min: 0 },
        completedAt: { type: Date },
        deletedAt: { type: Date, default: null },
    },
    { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } },
);

RepairOrderSchema.index({ customerId: 1, createdAt: -1 }, { name: 'idx_repairOrder_customerId_createdAt' });
RepairOrderSchema.index({ status: 1, dueAt: 1 }, { name: 'idx_repairOrder_status_dueAt' });
RepairOrderSchema.index(
    { deletedAt: 1 },
    { expireAfterSeconds: 2592000, name: 'idx_repairOrder_deletedAt_ttl', background: true },
);

export default mongoose.model<IRepairOrder>('RepairOrder', RepairOrderSchema);
