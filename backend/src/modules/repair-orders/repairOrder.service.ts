import mongoose, { Types } from 'mongoose';
import type { FilterQuery } from 'mongoose';
import RepairOrder from './repairOrder.model';
import Customer from '@modules/customers/customer.model';
import { IApiResponse } from '@common/interfaces/response.interface';
import type {
    CustomerGroupedRepairOrder,
    IRepairOrder,
    RepairOrderData,
    RepairOrderStatus,
} from '@common/interfaces/repairOrder.interface';
import type { ICustomer } from '@common/interfaces/customer.interface';
import { ApiError } from '@common/utils/ApiError';
import { normalizePhoneNumber } from '@common/utils/phoneUtils';
import { normalizeImageObjectKey } from '@common/services/r2.service';
import { cleanupUnreferencedImages } from '@common/services/imageCleanup.service';
import { generateRepairOrderPDF, generateCustomerGroupPDF } from '@common/services/pdf.service';
import {
    addVietnamMonths,
    getVietnamMonthYear,
    parseVietnamBusinessDate,
    vietnamEndOfMonthUtc,
    vietnamStartOfMonthUtc,
} from '@common/utils/timezone';
import { logger } from '@common/utils/logger';
import { APP_TIMEZONE } from '@config/environment';

interface DashboardAggregation {
    _id: { year: number; month: number };
    count: number;
    totalRevenue: number;
}

interface DashboardData {
    stats: {
        total: number;
        newOrders: number;
        repairing: number;
        completed: number;
        cancelled: number;
    };
    totalOrders: number;
    newOrders: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    chartData: Array<{ month: string; count: number; revenue: number }>;
    recentOrders: unknown[];
}

interface RepairOrderListQuery {
    page?: number;
    limit?: number;
    status?: RepairOrderStatus;
    search?: string;
}

interface RepairOrderListData {
    items: unknown[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
}

interface RepairOrderDetailData {
    order: RepairOrderData & { isOverdue: boolean };
    customer: ICustomer;
    tasks: string[];
}

interface CreateRepairOrderPayload {
    phone: string;
    fullName: string;
    customerNote?: string | null;
    productName: string;
    receivedAt?: unknown;
    dueAt: unknown;
    status?: RepairOrderStatus;
    note?: string | null;
    replacementMaterials?: unknown[];
    tasks?: unknown[];
    beforeImages?: unknown[];
    afterImages?: unknown[];
    totalAmount?: unknown;
}

interface UpdateRepairOrderPayload {
    productName?: string;
    receivedAt?: unknown;
    dueAt?: unknown;
    note?: string | null;
    status?: RepairOrderStatus;
    totalAmount?: unknown;
    replacementMaterials?: unknown[];
    tasks?: unknown[];
    beforeImages?: unknown[];
    afterImages?: unknown[];
}

interface RepairOrderUpdateFields {
    productName?: string;
    receivedAt?: Date;
    dueAt?: Date;
    note?: string;
    status?: RepairOrderStatus;
    completedAt?: Date | null;
    totalAmount?: number;
    replacementMaterials?: string[];
    tasks?: string[];
    beforeImages?: string[];
    afterImages?: string[];
}

interface CustomerGroupQuery {
    month?: number;
    year?: number;
    search?: string;
    customerId?: string;
}

interface CustomerGroupItem {
    customer: ICustomer;
    orders: CustomerGroupedRepairOrder[];
    totalAmount: number;
}

interface CustomerGroupData {
    month: number;
    year: number;
    customers: CustomerGroupItem[];
}

function isDuplicateKeyError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeImageReferences(images: unknown): string[] {
    if (!Array.isArray(images)) return [];
    const keys = images.map((image) => normalizeImageObjectKey(image));
    if (keys.some((key) => !key)) {
        throw new ApiError(400, 'Danh sách ảnh chứa object key không hợp lệ.');
    }
    return Array.from(new Set(keys as string[]));
}

export class RepairOrderService {
    public async getDashboardStats(): Promise<IApiResponse<DashboardData>> {
        const last12Months: { month: number; year: number; key: string }[] = [];
        const currentPeriod = getVietnamMonthYear();
        const firstPeriod = addVietnamMonths(currentPeriod.year, currentPeriod.month, -11);
        const startDate = vietnamStartOfMonthUtc(firstPeriod.year, firstPeriod.month);

        for (let i = 0; i < 12; i++) {
            const period = addVietnamMonths(firstPeriod.year, firstPeriod.month, i);
            last12Months.push({ ...period, key: `${period.month}/${period.year}` });
        }

        const [totalOrders, newOrders, inProgress, completed, cancelledOrders, monthlyStats, recentOrders] =
            await Promise.all([
                RepairOrder.countDocuments(),
                RepairOrder.countDocuments({ status: 'Mới nhận' }),
                RepairOrder.countDocuments({ status: 'Đang sửa' }),
                RepairOrder.countDocuments({ status: 'Hoàn thành' }),
                RepairOrder.countDocuments({ status: 'Đã hủy' }),
                RepairOrder.aggregate<DashboardAggregation>([
                    { $match: { receivedAt: { $gte: startDate } } },
                    {
                        $group: {
                            _id: {
                                year: { $year: { date: '$receivedAt', timezone: APP_TIMEZONE } },
                                month: { $month: { date: '$receivedAt', timezone: APP_TIMEZONE } },
                            },
                            count: { $sum: 1 },
                            totalRevenue: {
                                $sum: { $cond: [{ $eq: ['$status', 'Hoàn thành'] }, '$totalAmount', 0] },
                            },
                        },
                    },
                ]),
                RepairOrder.find()
                    .populate('customerId', 'fullName phone')
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .lean()
                    .exec(),
            ]);

        const statsMap = new Map<string, { count: number; revenue: number }>();
        monthlyStats.forEach((item) => {
            const key = `${item._id.month}/${item._id.year}`;
            statsMap.set(key, {
                count: item.count,
                revenue: item.totalRevenue,
            });
        });

        const chartData = last12Months.map((m) => {
            const existing = statsMap.get(m.key);
            return {
                month: m.key,
                count: existing ? existing.count : 0,
                revenue: existing ? existing.revenue : 0,
            };
        });

        return {
            success: true,
            message: 'Lấy thống kê dashboard thành công',
            data: {
                stats: {
                    total: totalOrders,
                    newOrders,
                    repairing: inProgress,
                    completed,
                    cancelled: cancelledOrders,
                },
                totalOrders,
                newOrders,
                inProgress,
                completed,
                cancelled: cancelledOrders,
                chartData,
                recentOrders,
            },
        };
    }

    public async getOrders(query: RepairOrderListQuery): Promise<IApiResponse<RepairOrderListData>> {
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
        const skip = (page - 1) * limit;

        const filter: FilterQuery<IRepairOrder> = {};
        if (query.status) {
            filter.status = query.status;
        }
        if (query.search) {
            const searchRegex = new RegExp(escapeRegExp(String(query.search)), 'i');
            filter.productName = searchRegex;
        }

        const [items, total] = await Promise.all([
            RepairOrder.find(filter)
                .populate('customerId', 'fullName phone')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
                .exec(),
            RepairOrder.countDocuments(filter),
        ]);

        return {
            success: true,
            message: 'Lấy danh sách phiếu sửa chữa thành công',
            data: {
                items,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            },
        };
    }

    public async getOrderDetail(id: string): Promise<IApiResponse<RepairOrderDetailData>> {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'ID phiếu sửa chữa không hợp lệ');
        }

        const order = await RepairOrder.findById(id).populate<{ customerId: ICustomer }>('customerId').exec();
        if (!order) {
            throw new ApiError(404, 'Không tìm thấy phiếu sửa chữa');
        }

        const isOverdue =
            order.status !== 'Hoàn thành' && order.status !== 'Đã hủy' && new Date() > new Date(order.dueAt);

        const orderData = order.toObject<RepairOrderData>();
        return {
            success: true,
            message: 'Lấy chi tiết phiếu sửa chữa thành công',
            data: {
                order: {
                    ...orderData,
                    isOverdue,
                },
                customer: order.customerId,
                tasks: order.tasks || [],
            },
        };
    }

    public async createOrder(
        payload: CreateRepairOrderPayload,
        userId: Types.ObjectId | string,
    ): Promise<IApiResponse<{ id: string }>> {
        const { phone, fullName, customerNote } = payload;
        const normalizedPhone = normalizePhoneNumber(phone);
        if (!normalizedPhone) throw new ApiError(400, 'Số điện thoại không hợp lệ.');

        const receivedAtDate = payload.receivedAt ? parseVietnamBusinessDate(payload.receivedAt) : new Date();
        const dueAtDate = parseVietnamBusinessDate(payload.dueAt, true);
        if (Number.isNaN(receivedAtDate.getTime()) || Number.isNaN(dueAtDate.getTime())) {
            throw new ApiError(400, 'Ngày tiếp nhận hoặc ngày hẹn trả không hợp lệ.');
        }
        if (dueAtDate.getTime() < receivedAtDate.getTime()) {
            throw new ApiError(400, 'Ngày hẹn trả không được trước ngày tiếp nhận.');
        }

        const tasks: string[] = Array.isArray(payload.tasks)
            ? Array.from(new Set(payload.tasks.map((t: unknown) => String(t).trim()).filter(Boolean)))
            : [];

        const computedTotal = payload.totalAmount !== undefined ? Number(payload.totalAmount) : 0;
        if (!Number.isSafeInteger(computedTotal) || computedTotal < 0 || computedTotal > 1_000_000_000_000) {
            throw new ApiError(400, 'Tổng tiền không hợp lệ.');
        }

        const beforeImages = normalizeImageReferences(payload.beforeImages);
        const afterImages = normalizeImageReferences(payload.afterImages);

        const initialStatus = payload.status || 'Mới nhận';
        const isInitialCompleted = initialStatus === 'Hoàn thành';

        let orderId = '';
        for (let attempt = 0; attempt < 2 && !orderId; attempt++) {
            const session = await mongoose.startSession();
            try {
                await session.withTransaction(async () => {
                    const customer = await Customer.findOneAndUpdate(
                        { normalizedPhone },
                        {
                            $setOnInsert: {
                                fullName: fullName.trim(),
                                phone: phone.trim(),
                                normalizedPhone,
                                note: customerNote ? String(customerNote).trim() : '',
                            },
                        },
                        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true, session },
                    );
                    if (!customer) throw new ApiError(500, 'Không thể tạo hoặc lấy thông tin khách hàng.');

                    const [orderDoc] = await RepairOrder.create(
                        [
                            {
                                customerId: customer._id,
                                productName: payload.productName.trim(),
                                receivedAt: receivedAtDate,
                                dueAt: dueAtDate,
                                status: initialStatus,
                                completedAt: isInitialCompleted ? new Date() : undefined,
                                note: String(payload.note ?? '').trim(),
                                replacementMaterials: Array.isArray(payload.replacementMaterials)
                                    ? Array.from(
                                          new Set(
                                              payload.replacementMaterials
                                                  .map((material: unknown) => String(material).trim())
                                                  .filter(Boolean),
                                          ),
                                      )
                                    : [],
                                tasks,
                                beforeImages,
                                afterImages,
                                totalAmount: computedTotal,
                            },
                        ],
                        { session },
                    );
                    orderId = String(orderDoc._id);
                });
            } catch (error: unknown) {
                orderId = '';
                if (!isDuplicateKeyError(error) || attempt > 0) throw error;
            } finally {
                await session.endSession();
            }
        }

        if (!orderId) throw new ApiError(500, 'Không thể tạo phiếu sửa chữa.');
        logger.info(`Repair order ${orderId} created by user ${String(userId)}.`);

        return {
            success: true,
            message: 'Tạo phiếu sửa chữa thành công',
            data: {
                id: orderId,
            },
        };
    }

    public async updateOrder(
        id: string,
        payload: UpdateRepairOrderPayload,
        actorId: Types.ObjectId | string,
    ): Promise<IApiResponse<IRepairOrder>> {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'ID phiếu sửa chữa không hợp lệ');
        }

        const existingOrder = await RepairOrder.findById(id);
        if (!existingOrder) throw new ApiError(404, 'Không tìm thấy phiếu sửa chữa');

        const {
            productName,
            receivedAt,
            dueAt,
            note,
            status,
            totalAmount,
            replacementMaterials,
            beforeImages,
            afterImages,
        } = payload;
        const updateFields: RepairOrderUpdateFields = {};

        if (productName !== undefined) updateFields.productName = productName.trim();
        const effectiveReceivedAt =
            receivedAt !== undefined ? parseVietnamBusinessDate(receivedAt) : new Date(existingOrder.receivedAt);
        const effectiveDueAt =
            dueAt !== undefined ? parseVietnamBusinessDate(dueAt, true) : new Date(existingOrder.dueAt);
        if (Number.isNaN(effectiveReceivedAt.getTime()) || Number.isNaN(effectiveDueAt.getTime())) {
            throw new ApiError(400, 'Ngày tiếp nhận hoặc ngày hẹn trả không hợp lệ.');
        }
        if (effectiveDueAt.getTime() < effectiveReceivedAt.getTime()) {
            throw new ApiError(400, 'Ngày hẹn trả không được trước ngày tiếp nhận.');
        }
        if (receivedAt !== undefined) updateFields.receivedAt = effectiveReceivedAt;
        if (dueAt !== undefined) updateFields.dueAt = effectiveDueAt;
        if (note !== undefined) updateFields.note = String(note ?? '').trim();
        if (status !== undefined) {
            updateFields.status = status;
            if (status === 'Hoàn thành') {
                if (existingOrder.status !== 'Hoàn thành' || !existingOrder.completedAt) {
                    updateFields.completedAt = new Date();
                }
            } else {
                updateFields.completedAt = null;
            }
        }
        if (totalAmount !== undefined) {
            const amount = Number(totalAmount);
            if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000_000_000) {
                throw new ApiError(400, 'Tổng tiền không hợp lệ.');
            }
            updateFields.totalAmount = amount;
        }

        if (Array.isArray(replacementMaterials)) {
            updateFields.replacementMaterials = Array.from(
                new Set(replacementMaterials.map((material: unknown) => String(material).trim()).filter(Boolean)),
            );
        }

        if (Array.isArray(payload.tasks)) {
            updateFields.tasks = Array.from(
                new Set(payload.tasks.map((task: unknown) => String(task).trim()).filter(Boolean)),
            );
        }

        if (Array.isArray(beforeImages)) {
            updateFields.beforeImages = normalizeImageReferences(beforeImages);
        }
        if (Array.isArray(afterImages)) {
            updateFields.afterImages = normalizeImageReferences(afterImages);
        }

        const order = await RepairOrder.findByIdAndUpdate(
            id,
            { $set: updateFields },
            { new: true, runValidators: true },
        );
        if (!order) {
            throw new ApiError(404, 'Không tìm thấy phiếu sửa chữa');
        }

        const previousKeys = [...(existingOrder.beforeImages || []), ...(existingOrder.afterImages || [])]
            .map((image) => normalizeImageObjectKey(image))
            .filter((key): key is string => Boolean(key));
        const currentKeys = new Set(
            [...(order.beforeImages || []), ...(order.afterImages || [])]
                .map((image) => normalizeImageObjectKey(image))
                .filter((key): key is string => Boolean(key)),
        );
        await cleanupUnreferencedImages(previousKeys.filter((key) => !currentKeys.has(key)));
        logger.info(
            `Audit repair-order.update actor=${String(actorId)} order=${id} fields=[${Object.keys(updateFields).sort().join(',')}]`,
        );

        return {
            success: true,
            message: 'Cập nhật phiếu sửa chữa thành công',
            data: order,
        };
    }

    public async generatePDFBuffer(id: string): Promise<{ buffer: Buffer; filename: string }> {
        const detailRes = await this.getOrderDetail(id);
        if (!detailRes.data) throw new ApiError(500, 'Không thể tải dữ liệu phiếu sửa chữa.');
        const { order, customer, tasks } = detailRes.data;
        const buffer = await generateRepairOrderPDF(order, customer, tasks);
        const filename = `Phieu-Sua-Chua-${id}.pdf`;
        return { buffer, filename };
    }

    public async generateCustomerPDFBuffer(
        customerId: string,
        month?: number,
        year?: number,
    ): Promise<{ buffer: Buffer; filename: string }> {
        if (!mongoose.Types.ObjectId.isValid(customerId)) {
            throw new ApiError(400, 'ID khách hàng không hợp lệ');
        }

        const groupRes = await this.getOrdersByCustomerGroup({ customerId, month, year });
        if (!groupRes.data) throw new ApiError(500, 'Không thể tải dữ liệu tổng hợp khách hàng.');
        const custGroup = groupRes.data.customers[0];
        if (!custGroup) {
            throw new ApiError(404, 'Không tìm thấy dữ liệu sửa chữa cho khách hàng này');
        }

        const validOrders = (custGroup.orders || []).filter((order) => order.status !== 'Đã hủy');
        if (validOrders.length > 250) {
            throw new ApiError(400, 'Bản PDF vượt quá 250 phiếu. Hãy chọn phạm vi tháng nhỏ hơn.');
        }

        const buffer = await generateCustomerGroupPDF(
            custGroup.customer,
            validOrders,
            month || groupRes.data.month,
            year || groupRes.data.year,
        );

        const safePhone = (custGroup.customer.phone || '').replace(/[^\d]/g, '');
        const filename = `Bang-Tong-Hop-Sua-Chua-${safePhone || 'Khach-Hang'}.pdf`;
        return { buffer, filename };
    }

    public async getOrdersByCustomerGroup(query: CustomerGroupQuery): Promise<IApiResponse<CustomerGroupData>> {
        const currentPeriod = getVietnamMonthYear();
        const month = query.month || currentPeriod.month;
        const year = query.year || currentPeriod.year;
        const currentMonthEnd = vietnamEndOfMonthUtc(year, month);

        const customerFilter: FilterQuery<ICustomer> = {};
        if (query.customerId) {
            if (!mongoose.Types.ObjectId.isValid(query.customerId)) {
                throw new ApiError(400, 'ID khách hàng không hợp lệ');
            }
            customerFilter._id = new Types.ObjectId(query.customerId);
        } else if (query.search) {
            const searchRegex = new RegExp(escapeRegExp(query.search), 'i');
            customerFilter.$or = [{ fullName: searchRegex }, { phone: searchRegex }, { normalizedPhone: searchRegex }];
        }

        const matchedCustomers = await Customer.find(customerFilter).sort({ createdAt: -1 }).exec();
        const targetCustomerIds = matchedCustomers.map((c) => c._id);

        const orderFilter: FilterQuery<IRepairOrder> = {
            receivedAt: { $lte: currentMonthEnd },
            customerId: { $in: targetCustomerIds },
        };

        const allOrders = await RepairOrder.find(orderFilter)
            .populate<{ customerId: ICustomer }>('customerId')
            .sort({ receivedAt: 1, createdAt: 1 })
            .exec();

        const customerMap = new Map<string, CustomerGroupItem>();

        // Pre-populate customerMap with all matched customers so they show up even with 0 orders
        for (const customer of matchedCustomers) {
            customerMap.set(String(customer._id), {
                customer,
                orders: [],
                totalAmount: 0,
            });
        }

        for (const order of allOrders) {
            if (!order.customerId) continue;
            const custId = String(order.customerId._id);

            if (!customerMap.has(custId)) {
                continue;
            }

            const tasks = order.tasks || [];

            const orderPeriod = getVietnamMonthYear(new Date(order.receivedAt || order.createdAt));
            const orderYear = orderPeriod.year;
            const orderMonth = orderPeriod.month;

            const currentRealYear = currentPeriod.year;
            const currentRealMonth = currentPeriod.month;
            const isViewingCurrentMonth = year === currentRealYear && month === currentRealMonth;

            const isPastOrder = orderYear < year || (orderYear === year && orderMonth < month);

            const isCompleted = order.status === 'Hoàn thành';
            const isCancelled = order.status === 'Đã hủy';

            const completedDate = isCompleted
                ? order.completedAt
                    ? new Date(order.completedAt)
                    : new Date(order.updatedAt || order.receivedAt || order.createdAt)
                : null;

            const completedPeriod = completedDate ? getVietnamMonthYear(completedDate) : null;
            const completedYear = completedPeriod?.year ?? null;
            const completedMonth = completedPeriod?.month ?? null;

            // Check if order was ALREADY completed in a month BEFORE the target view month
            const isFinishedBeforeTargetMonth =
                isCompleted &&
                completedDate &&
                (completedYear! < year || (completedYear! === year && completedMonth! < month));

            // Check if order was completed IN the target view month
            const isFinishedInTargetMonth =
                isCompleted && completedDate && completedYear === year && completedMonth === month;

            // 1. Past cancelled orders do not roll over
            if (isPastOrder && isCancelled) {
                continue;
            }

            // 2. If order was ALREADY finished in a previous month before target month, do not roll it over to target month
            if (isPastOrder && isFinishedBeforeTargetMonth) {
                continue;
            }

            // 3. If order is from a past month and was NOT finished before target month:
            // - If target month is current real-time month, roll it over!
            // - If target month is a historical past month, only include it if it was finished in that historical month.
            if (isPastOrder && !isViewingCurrentMonth && !isFinishedInTargetMonth) {
                continue;
            }

            const isRollover = isPastOrder;
            const monthsAgo = isRollover ? (year - orderYear) * 12 + (month - orderMonth) : 0;

            const isOriginalMonth = orderYear === year && orderMonth === month;
            const targetPushedMonth = completedMonth ? completedMonth : currentRealMonth;
            const targetPushedYear = completedYear ? completedYear : currentRealYear;
            const isPushedForward =
                isOriginalMonth &&
                !isFinishedInTargetMonth &&
                (targetPushedYear > year || (targetPushedYear === year && targetPushedMonth > month));

            const group = customerMap.get(custId);
            if (!group) continue;
            const orderObj: CustomerGroupedRepairOrder = {
                ...order.toObject<RepairOrderData>(),
                tasks,
                beforeImages: Array.isArray(order.beforeImages) ? order.beforeImages : [],
                afterImages: Array.isArray(order.afterImages) ? order.afterImages : [],
                totalAmount: order.totalAmount || 0,
                isRollover,
                monthsAgo,
                isPushedForward,
                pushedToMonth: isPushedForward ? targetPushedMonth : null,
                pushedToYear: isPushedForward ? targetPushedYear : null,
            };
            group.orders.push(orderObj);
            if (!isCancelled) group.totalAmount += orderObj.totalAmount;
        }

        if (query.customerId && customerMap.size === 0 && mongoose.Types.ObjectId.isValid(query.customerId)) {
            const customerObj = await Customer.findById(query.customerId);
            if (customerObj) {
                customerMap.set(String(customerObj._id), {
                    customer: customerObj,
                    orders: [],
                    totalAmount: 0,
                });
            }
        }

        const resultList = Array.from(customerMap.values());

        return {
            success: true,
            message: 'Lấy dữ liệu danh sách theo khách hàng thành công',
            data: {
                month,
                year,
                customers: resultList,
            },
        };
    }

    public async deleteOrder(id: string, actorId: Types.ObjectId | string): Promise<IApiResponse<void>> {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'ID phiếu sửa chữa không hợp lệ');
        }

        const order = await RepairOrder.findByIdAndDelete(id);
        if (!order) {
            throw new ApiError(404, 'Không tìm thấy phiếu sửa chữa để xóa');
        }

        const imageKeys = [...(order.beforeImages || []), ...(order.afterImages || [])]
            .map((image) => normalizeImageObjectKey(image))
            .filter((key): key is string => Boolean(key));
        await cleanupUnreferencedImages(imageKeys);
        logger.info(`Audit repair-order.delete actor=${String(actorId)} order=${id} fields=[record]`);

        return {
            success: true,
            message: 'Xóa phiếu sửa chữa thành công',
        };
    }

    public async deleteUnreferencedImage(input: unknown): Promise<IApiResponse<{ objectKey: string }>> {
        const objectKey = normalizeImageObjectKey(input);
        const filename = objectKey?.split('/').pop() || '';
        if (!objectKey?.startsWith('repairs/') || filename.startsWith('thumb_')) {
            throw new ApiError(400, 'Chỉ có thể dọn ảnh tải lên tạm thời hợp lệ.');
        }

        const cleanupResult = await cleanupUnreferencedImages([objectKey]);
        if (cleanupResult.referenced.includes(objectKey)) {
            throw new ApiError(409, 'Ảnh đang được một phiếu sửa chữa sử dụng nên không thể xóa.');
        }
        if (cleanupResult.failures.length > 0) throw cleanupResult.failures[0].error;

        return {
            success: true,
            message: 'Đã dọn ảnh tải lên chưa được sử dụng.',
            data: { objectKey },
        };
    }
}

export const repairOrderService = new RepairOrderService();
