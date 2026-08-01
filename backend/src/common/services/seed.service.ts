import Customer from '@modules/customers/customer.model';
import RepairOrder from '@modules/repair-orders/repairOrder.model';
import { logger } from '@common/utils/logger';

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
            status: 'Mới nhận',
            tasks: ['Vệ sinh và dưỡng da'],
            replacementMaterials: [],
            beforeImages: [],
            afterImages: [],
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
            beforeImages: [],
            afterImages: [],
            note: 'Dữ liệu mẫu môi trường phát triển',
            totalAmount: 250_000,
        },
    ]);
}
