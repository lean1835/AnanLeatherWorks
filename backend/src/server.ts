import mongoose from 'mongoose';
import type { Server } from 'http';
import { ENABLE_DEV_SEED, MONGODB_URI, NODE_ENV, PORT, validateEnvironment } from '@config/environment';
import {
    migrateLegacyCancelledOrders,
    migrateLegacyImageFields,
    migrateLegacyStatuses,
    seedInitialData,
} from '@common/services/seed.service';
import { repairOrderService } from '@modules/repair-orders/repairOrder.service';
import { logger } from '@common/utils/logger';

let httpServer: Server | undefined;
let isShuttingDown = false;

async function bootstrap() {
    try {
        validateEnvironment();
        logger.info('⏳ Connecting to MongoDB Database...');
        await mongoose.connect(MONGODB_URI, { autoIndex: NODE_ENV !== 'production' });
        logger.info('✅ MongoDB Database connected successfully.');

        await migrateLegacyStatuses();
        await migrateLegacyImageFields();
        await migrateLegacyCancelledOrders();
        await repairOrderService.purgeExpiredTrashOrders().catch((err) => {
            logger.error('Failed to auto-purge expired trash orders:', err);
        });

        if (NODE_ENV !== 'production' && ENABLE_DEV_SEED) {
            await seedInitialData();
        }

        // Load HTTP routes only after configuration and DB readiness have succeeded.
        const { default: app } = await import('./app');
        httpServer = app.listen(PORT, () => {
            logger.info(`🚀 Anan Leather Backend running on port ${PORT}`);
        });
        httpServer.on('error', (error) => void shutdown('http-server-error', error));
    } catch (error) {
        logger.error('❌ Failed to start server:', error);
        await mongoose.disconnect().catch(() => undefined);
        process.exit(1);
    }
}

async function shutdown(signal: string, error?: unknown): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;
    if (error) logger.error(`Shutting down after ${signal}:`, error);
    else logger.info(`Received ${signal}. Starting graceful shutdown.`);

    const forceExitTimer = setTimeout(() => {
        logger.error('Graceful shutdown timed out.');
        process.exit(1);
    }, 10_000);
    forceExitTimer.unref();

    try {
        if (httpServer) {
            await new Promise<void>((resolve, reject) => {
                httpServer!.close((closeError) => (closeError ? reject(closeError) : resolve()));
            });
        }
        await mongoose.disconnect();
        clearTimeout(forceExitTimer);
        process.exit(error ? 1 : 0);
    } catch (shutdownError) {
        logger.error('Graceful shutdown failed:', shutdownError);
        clearTimeout(forceExitTimer);
        process.exit(1);
    }
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('uncaughtException', (error) => void shutdown('uncaughtException', error));
process.once('unhandledRejection', (reason) => void shutdown('unhandledRejection', reason));

void bootstrap();
