import mongoose from 'mongoose';
import Customer from '@modules/customers/customer.model';
import RepairOrder from '@modules/repair-orders/repairOrder.model';
import { logger } from '@common/utils/logger';

/**
 * Migrates any legacy repair orders with status 'Mới nhận' to 'Đang sửa' on server startup.
 */
export async function migrateLegacyStatuses(): Promise<void> {
    try {
        const result = await RepairOrder.updateMany({ status: 'Mới nhận' }, { $set: { status: 'Đang sửa' } });
        if (result.modifiedCount > 0) {
            logger.info(`Migrated ${result.modifiedCount} legacy 'Mới nhận' repair orders to 'Đang sửa'.`);
        }
    } catch (error) {
        logger.error('Failed to migrate legacy repair order statuses:', error);
    }
}

/**
 * Migrates any legacy repair orders with 'beforeImages' or 'afterImages' to the unified 'images' field,
 * and unsets the legacy fields from MongoDB documents.
 */
export async function migrateLegacyImageFields(): Promise<void> {
    try {
        const collection = mongoose.connection.db?.collection('repairorders');
        if (!collection) return;

        const legacyOrders = await collection.find({
            $or: [
                { beforeImages: { $exists: true } },
                { afterImages: { $exists: true } },
            ],
        }).toArray();

        if (legacyOrders.length === 0) return;

        const bulkOps = legacyOrders.map((order) => {
            const before = Array.isArray(order.beforeImages) ? (order.beforeImages as string[]) : [];
            const after = Array.isArray(order.afterImages) ? (order.afterImages as string[]) : [];
            const currentImages = Array.isArray(order.images) ? (order.images as string[]) : [];

            const mergedImages = Array.from(new Set([...currentImages, ...before, ...after])).filter(
                (img): img is string => typeof img === 'string' && Boolean(img.trim()),
            );

            return {
                updateOne: {
                    filter: { _id: order._id },
                    update: {
                        $set: { images: mergedImages },
                        $unset: { beforeImages: 1, afterImages: 1 },
                    },
                },
            };
        });

        if (bulkOps.length > 0) {
            const result = await collection.bulkWrite(bulkOps);
            logger.info(
                `Migrated ${result.modifiedCount} legacy repair order document(s) from 'beforeImages/afterImages' to 'images'.`,
            );
        }
    } catch (error) {
        logger.error('Failed to migrate legacy repair order image fields:', error);
    }
}

/**
 * Migrates any legacy repair orders with status 'Đã hủy' to have 'deletedAt' set,
 * converting them into soft-deleted trash items.
 */
export async function migrateLegacyCancelledOrders(): Promise<void> {
    try {
        const collection = mongoose.connection.db?.collection('repairorders');
        if (!collection) return;

        const result = await collection.updateMany(
            { status: 'Đã hủy' },
            {
                $set: { deletedAt: new Date(), status: 'Đang sửa' },
            },
        );

        if (result.modifiedCount > 0) {
            logger.info(`Migrated ${result.modifiedCount} legacy 'Đã hủy' repair order(s) into soft-deleted trash items.`);
        }
    } catch (error) {
        logger.error('Failed to migrate legacy cancelled repair orders:', error);
    }
}

/**
 * Optional, idempotent sample data for an explicitly enabled development environment.
 * Authentication users are deliberately never created here.
 */
export async function seedInitialData(): Promise<void> {
    const existingOrder = await RepairOrder.exists({});
    if (existingOrder) {
        logger.info('Development seed skipped because repair-order data already exists.');
        return;
    }

    logger.warn('ENABLE_DEV_SEED is active; inserting non-sensitive sample business data.');

    const sampleCustomers = [
        {
            fullName: 'Khách hàng mẫu 01',
            phone: '0900000001',
            normalizedPhone: '0900000001',
            note: 'Dữ liệu mẫu dùng trong môi trường phát triển',
        },
        {
            fullName: 'Khách hàng mẫu 02',
            phone: '0900000002',
            normalizedPhone: '0900000002',
            note: 'Dữ liệu mẫu dùng trong môi trường phát triển',
        },
    ];

    const customers = await Promise.all(
        sampleCustomers.map((customer) =>
            Customer.findOneAndUpdate(
                { normalizedPhone: customer.normalizedPhone },
                { $setOnInsert: customer },
                { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
            ),
        ),
    );

    const now = new Date();
    const receivedAt = new Date(now);
    receivedAt.setDate(receivedAt.getDate() - 2);
    const dueAt = new Date(now);
    dueAt.setDate(dueAt.getDate() + 12);

    await RepairOrder.insertMany([
        {
            customerId: customers[0]._id,
            productName: 'Túi da mẫu',
            receivedAt,
            dueAt,
            status: 'Đang sửa',
            tasks: ['Vệ sinh và dưỡng da'],
            replacementMaterials: [],
            images: [],
            note: 'Dữ liệu mẫu môi trường phát triển',
            totalAmount: 350_000,
        },
        {
            customerId: customers[1]._id,
            productName: 'Ví da mẫu',
            receivedAt,
            dueAt,
            status: 'Đang sửa',
            tasks: ['Khâu phục hồi đường chỉ'],
            replacementMaterials: ['Chỉ sáp'],
            images: [],
            note: 'Dữ liệu mẫu môi trường phát triển',
            totalAmount: 250_000,
        },
    ]);
}
