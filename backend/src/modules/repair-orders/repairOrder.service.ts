import mongoose, { Types } from 'mongoose';
import type { FilterQuery } from 'mongoose';
import RepairOrder from './repairOrder.model';
import Customer from '@modules/customers/customer.model';
import { IApiResponse } from '@common/interfaces/response.interface';
import type {
    CustomerGroupedRepairOrder,
    IRepairOrder,
    IRepairOrderTrashItem,
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
        totalCustomers: number;
        newOrders: number;
        repairing: number;
        completed: number;
    };
    totalOrders: number;
    totalCustomers: number;
    newOrders: number;
    inProgress: number;
    completed: number;
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
    images?: unknown[];
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
    images?: unknown[];
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
    images?: string[];
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

        const activeFilter = { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] };

        const [totalOrders, inProgress, completed, monthlyStats, recentOrders, totalCustomers] =
            await Promise.all([
                RepairOrder.countDocuments(activeFilter),
                RepairOrder.countDocuments({ ...activeFilter, status: 'Đang sửa' }),
                RepairOrder.countDocuments({ ...activeFilter, status: { $in: ['Hoàn thành', 'Đã thanh toán'] } }),
                RepairOrder.aggregate<DashboardAggregation>([
                    { $match: { ...activeFilter, receivedAt: { $gte: startDate } } },
                    {
                        $group: {
                            _id: {
                                year: { $year: { date: '$receivedAt', timezone: APP_TIMEZONE } },
                                month: { $month: { date: '$receivedAt', timezone: APP_TIMEZONE } },
                            },
                            count: { $sum: 1 },
                            totalRevenue: {
                                $sum: {
                                    $cond: [{ $in: ['$status', ['Hoàn thành', 'Đã thanh toán']] }, '$totalAmount', 0],
                                },
                            },
                        },
                    },
                ]),
                RepairOrder.find(activeFilter)
                    .populate('customerId', 'fullName phone')
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .lean()
                    .exec(),
                Customer.countDocuments(),
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
                    totalCustomers,
                    newOrders: 0,
                    repairing: inProgress,
                    completed,
                },
                totalOrders,
                totalCustomers,
                newOrders: 0,
                inProgress,
                completed,
                chartData,
                recentOrders,
            },
        };
    }

    public async getOrders(query: RepairOrderListQuery): Promise<IApiResponse<RepairOrderListData>> {
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
        const skip = (page - 1) * limit;

        const filter: FilterQuery<IRepairOrder> = {
            $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
        };
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

        const order = await RepairOrder.findOne({
            _id: id,
            $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
        }).populate<{ customerId: ICustomer }>('customerId').exec();
        if (!order) {
            throw new ApiError(404, 'Không tìm thấy phiếu sửa chữa');
        }

        const isOverdue =
            order.status !== 'Hoàn thành' && order.status !== 'Đã thanh toán' && new Date() > new Date(order.dueAt);

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

        const images = normalizeImageReferences(payload.images);

        const initialStatus = payload.status || 'Đang sửa';
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
                                images,
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

        const existingOrder = await RepairOrder.findOne({
            _id: id,
            $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
        });
        if (!existingOrder) throw new ApiError(404, 'Không tìm thấy phiếu sửa chữa');

        const {
            productName,
            receivedAt,
            dueAt,
            note,
            status,
            totalAmount,
            replacementMaterials,
            images,
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

        if (Array.isArray(images)) {
            updateFields.images = normalizeImageReferences(images);
        }

        const order = await RepairOrder.findByIdAndUpdate(
            id,
            { $set: updateFields },
            { new: true, runValidators: true },
        );
        if (!order) {
            throw new ApiError(404, 'Không tìm thấy phiếu sửa chữa');
        }

        const previousKeys = (existingOrder.images || [])
            .map((image) => normalizeImageObjectKey(image))
            .filter((key): key is string => Boolean(key));

        const currentKeys = new Set(
            (order.images || [])
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

        const validOrders = (custGroup.orders || []).filter(
            (order) => order.status !== 'Đã thanh toán' && (order.status as string) !== 'Đã hủy',
        );
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
            $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
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

            const isPaid = order.status === 'Đã thanh toán';
            const isCompleted = order.status === 'Hoàn thành' || isPaid;

            // If an order from a past month is 'Đã thanh toán', do NOT roll it over to subsequent months
            if (isPastOrder && isPaid) {
                continue;
            }

            const completedDate = isCompleted
                ? order.completedAt
                    ? new Date(order.completedAt)
                    : new Date(order.updatedAt || order.receivedAt || order.createdAt)
                : null;

            const completedPeriod = completedDate ? getVietnamMonthYear(completedDate) : null;
            const completedYear = completedPeriod?.year ?? null;
            const completedMonth = completedPeriod?.month ?? null;

            // Check if order was ALREADY completed/paid in a month BEFORE the target view month
            const isFinishedBeforeTargetMonth =
                isCompleted &&
                completedDate &&
                (completedYear! < year || (completedYear! === year && completedMonth! < month));

            // Check if order was completed/paid IN the target view month
            const isFinishedInTargetMonth =
                isCompleted && completedDate && completedYear === year && completedMonth === month;

            // If order was ALREADY finished in a previous month before target month, do not roll it over to target month
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
            const images = Array.isArray(order.images) ? order.images : [];
            const orderObj: CustomerGroupedRepairOrder = {
                ...order.toObject<RepairOrderData>(),
                tasks,
                images,
                totalAmount: order.totalAmount || 0,
                isRollover,
                monthsAgo,
                isPushedForward,
                pushedToMonth: isPushedForward ? targetPushedMonth : null,
                pushedToYear: isPushedForward ? targetPushedYear : null,
            };
            group.orders.push(orderObj);
            group.totalAmount += orderObj.totalAmount;
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

        const order = await RepairOrder.findOneAndUpdate(
            { _id: id, $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] },
            { $set: { deletedAt: new Date() } },
            { new: true },
        );
        if (!order) {
            throw new ApiError(404, 'Không tìm thấy phiếu sửa chữa để chuyển vào thùng rác');
        }

        logger.info(`Audit repair-order.soft-delete actor=${String(actorId)} order=${id}`);

        return {
            success: true,
            message: 'Đã chuyển phiếu sửa chữa vào thùng rác',
        };
    }

    public async getTrashOrders(): Promise<IApiResponse<IRepairOrderTrashItem[]>> {
        const deletedOrders = await RepairOrder.find({ deletedAt: { $ne: null } })
            .populate('customerId', 'fullName phone')
            .sort({ deletedAt: -1 })
            .lean()
            .exec();

        const now = Date.now();
        const items: IRepairOrderTrashItem[] = deletedOrders.map((order) => {
            const deletedTime = order.deletedAt ? new Date(order.deletedAt).getTime() : now;
            const daysPast = Math.floor((now - deletedTime) / (1000 * 60 * 60 * 24));
            const daysRemaining = Math.max(0, 30 - daysPast);
            return {
                ...order,
                deletedAt: order.deletedAt || new Date(deletedTime),
                daysRemaining,
            } as IRepairOrderTrashItem;
        });

        return {
            success: true,
            message: 'Lấy danh sách phiếu đã xóa thành công',
            data: items,
        };
    }

    public async restoreOrder(id: string, actorId: Types.ObjectId | string): Promise<IApiResponse<void>> {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'ID phiếu sửa chữa không hợp lệ');
        }

        const order = await RepairOrder.findOneAndUpdate(
            { _id: id, deletedAt: { $ne: null } },
            { $set: { deletedAt: null } },
            { new: true },
        );

        if (!order) {
            throw new ApiError(404, 'Không tìm thấy phiếu sửa chữa trong thùng rác để khôi phục');
        }

        logger.info(`Audit repair-order.restore actor=${String(actorId)} order=${id}`);

        return {
            success: true,
            message: 'Khôi phục phiếu sửa chữa thành công',
        };
    }

    public async permanentDeleteOrder(id: string, actorId: Types.ObjectId | string): Promise<IApiResponse<void>> {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'ID phiếu sửa chữa không hợp lệ');
        }

        const order = await RepairOrder.findOneAndDelete({ _id: id, deletedAt: { $ne: null } });
        if (!order) {
            throw new ApiError(404, 'Không tìm thấy phiếu sửa chữa trong thùng rác để xóa vĩnh viễn');
        }

        const imageKeys = (order.images || [])
            .map((image) => normalizeImageObjectKey(image))
            .filter((key): key is string => Boolean(key));
        await cleanupUnreferencedImages(imageKeys);
        logger.info(`Audit repair-order.permanent-delete actor=${String(actorId)} order=${id}`);

        return {
            success: true,
            message: 'Đã xóa vĩnh viễn phiếu sửa chữa khỏi hệ thống',
        };
    }

    public async restoreAllTrashOrders(actorId: Types.ObjectId | string): Promise<IApiResponse<void>> {
        const result = await RepairOrder.updateMany(
            { deletedAt: { $ne: null } },
            { $set: { deletedAt: null } },
        );

        logger.info(`Audit repair-order.restore-all actor=${String(actorId)} count=${result.modifiedCount}`);

        return {
            success: true,
            message: `Đã khôi phục ${result.modifiedCount} phiếu sửa chữa từ thùng rác`,
        };
    }

    public async emptyTrash(actorId: Types.ObjectId | string): Promise<IApiResponse<void>> {
        const deletedOrders = await RepairOrder.find({ deletedAt: { $ne: null } })
            .select('images')
            .lean()
            .exec();

        if (deletedOrders.length === 0) {
            return {
                success: true,
                message: 'Thùng rác đã trống',
            };
        }

        const imageKeys = new Set<string>();
        for (const order of deletedOrders) {
            for (const image of order.images || []) {
                const key = normalizeImageObjectKey(image);
                if (key) imageKeys.add(key);
            }
        }

        await RepairOrder.deleteMany({ deletedAt: { $ne: null } });
        await cleanupUnreferencedImages(imageKeys);

        logger.info(`Audit repair-order.empty-trash actor=${String(actorId)} count=${deletedOrders.length}`);

        return {
            success: true,
            message: `Đã xóa vĩnh viễn tất cả ${deletedOrders.length} phiếu sửa chữa trong thùng rác`,
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

    public async purgeExpiredTrashOrders(): Promise<number> {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const expiredOrders = await RepairOrder.find({
            deletedAt: { $ne: null, $lte: thirtyDaysAgo },
        })
            .select('images')
            .lean()
            .exec();

        if (expiredOrders.length === 0) return 0;

        const imageKeys = new Set<string>();
        for (const order of expiredOrders) {
            for (const image of order.images || []) {
                const key = normalizeImageObjectKey(image);
                if (key) imageKeys.add(key);
            }
        }

        const expiredIds = expiredOrders.map((order) => order._id);
        await RepairOrder.deleteMany({ _id: { $in: expiredIds } });
        await cleanupUnreferencedImages(imageKeys);

        logger.info(`Auto-purged ${expiredOrders.length} trash order(s) older than 30 days.`);
        return expiredOrders.length;
    }
}

export const repairOrderService = new RepairOrderService();
