import mongoose, { Types } from 'mongoose';
import Customer from './customer.model';
import RepairOrder from '../repair-orders/repairOrder.model';
import { ICustomer, ICustomerPayload } from '@common/interfaces/customer.interface';
import { IApiResponse } from '@common/interfaces/response.interface';
import { normalizePhoneNumber } from '@common/utils/phoneUtils';
import { ApiError } from '@common/utils/ApiError';
import { normalizeImageObjectKey } from '@common/services/r2.service';
import { cleanupUnreferencedImages } from '@common/services/imageCleanup.service';
import { logger } from '@common/utils/logger';

export class CustomerService {
    public async getByPhone(phoneParam: string): Promise<IApiResponse<ICustomer | null>> {
        const normalized = normalizePhoneNumber(phoneParam);
        if (!normalized) {
            return {
                success: true,
                message: 'Số điện thoại không hợp lệ',
                data: null,
            };
        }

        const customer = await Customer.findOne({ normalizedPhone: normalized });
        return {
            success: true,
            message: customer ? 'Lấy thông tin khách hàng thành công' : 'Không tìm thấy khách hàng',
            data: customer || null,
        };
    }

    public async getAll(): Promise<IApiResponse<ICustomer[]>> {
        const customers = await Customer.find().sort({ createdAt: -1 });
        return {
            success: true,
            message: 'Lấy danh sách khách hàng thành công',
            data: customers,
        };
    }

    public async createCustomer(payload: ICustomerPayload): Promise<IApiResponse<ICustomer>> {
        const normalized = normalizePhoneNumber(payload.phone);
        if (!normalized) {
            throw new ApiError(400, 'Số điện thoại không hợp lệ.');
        }

        const existing = await Customer.findOne({ normalizedPhone: normalized });
        if (existing) {
            throw new ApiError(400, 'Khách hàng với số điện thoại này đã tồn tại.');
        }

        const customer = await Customer.create({
            fullName: payload.fullName.trim(),
            phone: payload.phone.trim(),
            normalizedPhone: normalized,
            email: payload.email ? payload.email.trim() : '',
            dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
            note: payload.note ? payload.note.trim() : '',
        });

        return {
            success: true,
            message: 'Tạo thông tin khách hàng thành công',
            data: customer,
        };
    }

    public async updateCustomer(
        id: string,
        payload: Partial<ICustomerPayload>,
        actorId: Types.ObjectId | string,
    ): Promise<IApiResponse<ICustomer>> {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'ID khách hàng không hợp lệ.');
        }

        const updateFields: {
            fullName?: string;
            phone?: string;
            normalizedPhone?: string;
            email?: string;
            dateOfBirth?: Date | null;
            note?: string;
        } = {};
        if (payload.fullName !== undefined) updateFields.fullName = payload.fullName.trim();
        if (payload.phone !== undefined) {
            const normalized = normalizePhoneNumber(payload.phone);
            if (!normalized) throw new ApiError(400, 'Số điện thoại không hợp lệ.');
            updateFields.phone = payload.phone.trim();
            updateFields.normalizedPhone = normalized;
        }
        if (payload.email !== undefined) updateFields.email = String(payload.email ?? '').trim();
        if (payload.dateOfBirth !== undefined)
            updateFields.dateOfBirth = payload.dateOfBirth ? new Date(payload.dateOfBirth) : null;
        if (payload.note !== undefined) updateFields.note = String(payload.note ?? '').trim();

        const customer = await Customer.findByIdAndUpdate(
            id,
            { $set: updateFields },
            { new: true, runValidators: true },
        );
        if (!customer) {
            throw new ApiError(404, 'Không tìm thấy thông tin khách hàng.');
        }
        logger.info(
            `Audit customer.update actor=${String(actorId)} customer=${id} fields=[${Object.keys(updateFields).sort().join(',')}]`,
        );

        return {
            success: true,
            message: 'Cập nhật thông tin khách hàng thành công',
            data: customer,
        };
    }

    public async deleteCustomer(id: string, actorId: Types.ObjectId | string): Promise<IApiResponse<void>> {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'ID khách hàng không hợp lệ.');
        }

        const session = await mongoose.startSession();
        const imageKeys = new Set<string>();
        try {
            await session.withTransaction(async () => {
                const customer = await Customer.findById(id).session(session);
                if (!customer) {
                    throw new ApiError(404, 'Không tìm thấy thông tin khách hàng.');
                }

                const orders = await RepairOrder.find({ customerId: id })
                    .select('images')
                    .session(session)
                    .lean();
                for (const order of orders) {
                    for (const image of order.images || []) {
                        const key = normalizeImageObjectKey(image);
                        if (key) imageKeys.add(key);
                    }
                }

                await RepairOrder.deleteMany({ customerId: id }, { session });
                await Customer.deleteOne({ _id: id }, { session });
            });
        } finally {
            await session.endSession();
        }

        await cleanupUnreferencedImages(imageKeys);
        logger.info(`Audit customer.delete actor=${String(actorId)} customer=${id} fields=[record,repairOrders]`);

        return {
            success: true,
            message: 'Xóa khách hàng và toàn bộ dữ liệu thành công',
        };
    }
}

export const customerService = new CustomerService();
