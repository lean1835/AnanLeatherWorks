import { Router } from 'express';
import multer from 'multer';
import {
    getDashboardStats,
    getRepairOrders,
    getRepairOrderDetail,
    createRepairOrder,
    updateRepairOrder,
    exportOrderPDF,
    exportCustomerPDF,
    getByCustomerGroup,
    deleteRepairOrder,
    getTrashOrders,
    restoreAllTrashOrders,
    emptyTrash,
    restoreRepairOrder,
    permanentDeleteRepairOrder,
    uploadOrderImage,
    streamImage,
    deleteUnreferencedImage,
} from './repairOrder.controller';
import { authenticate } from '@common/middlewares/auth.middleware';
import { validate } from '@common/middlewares/validate.middleware';
import {
    createRepairOrderSchema,
    customerGroupQuerySchema,
    customerPdfParamsSchema,
    imageKeyParamsSchema,
    repairOrderIdParamsSchema,
    repairOrderListQuerySchema,
    updateRepairOrderSchema,
} from './repairOrder.validation';
import { requireCapability } from '@common/middlewares/capability.middleware';
import { CAPABILITIES } from '@config/capabilities';
import { ApiError } from '@common/utils/ApiError';

const upload = multer({
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new ApiError(400, 'Chỉ chấp nhận tệp hình ảnh'));
        }
    },
});

const router = Router();

router.use(authenticate);

router.get('/stream/:key', requireCapability(CAPABILITIES.REPAIR_ORDERS_VIEW), streamImage);
router.post(
    '/upload-image',
    requireCapability(CAPABILITIES.REPAIR_IMAGES_UPLOAD),
    upload.single('image'),
    uploadOrderImage,
);
router.delete(
    '/images/:key',
    requireCapability(CAPABILITIES.REPAIR_IMAGES_UPLOAD),
    validate(imageKeyParamsSchema, 'params'),
    deleteUnreferencedImage,
);
router.get('/dashboard-stats', requireCapability(CAPABILITIES.DASHBOARD_VIEW), getDashboardStats);
router.get(
    '/customer-group',
    requireCapability(CAPABILITIES.REPAIR_ORDERS_VIEW),
    validate(customerGroupQuerySchema, 'query'),
    getByCustomerGroup,
);
router.get(
    '/customer/:customerId/pdf',
    requireCapability(CAPABILITIES.REPAIR_ORDERS_EXPORT),
    validate(customerPdfParamsSchema, 'params'),
    validate(customerGroupQuerySchema, 'query'),
    exportCustomerPDF,
);
router.get(
    '/',
    requireCapability(CAPABILITIES.REPAIR_ORDERS_VIEW),
    validate(repairOrderListQuerySchema, 'query'),
    getRepairOrders,
);
router.get('/trash', requireCapability(CAPABILITIES.REPAIR_ORDERS_VIEW), getTrashOrders);
router.patch('/trash/restore-all', requireCapability(CAPABILITIES.REPAIR_ORDERS_UPDATE), restoreAllTrashOrders);
router.delete('/trash/empty', requireCapability(CAPABILITIES.REPAIR_ORDERS_DELETE), emptyTrash);
router.patch(
    '/:id/restore',
    requireCapability(CAPABILITIES.REPAIR_ORDERS_UPDATE),
    validate(repairOrderIdParamsSchema, 'params'),
    restoreRepairOrder,
);
router.delete(
    '/:id/permanent',
    requireCapability(CAPABILITIES.REPAIR_ORDERS_DELETE),
    validate(repairOrderIdParamsSchema, 'params'),
    permanentDeleteRepairOrder,
);
router.get(
    '/:id',
    requireCapability(CAPABILITIES.REPAIR_ORDERS_VIEW),
    validate(repairOrderIdParamsSchema, 'params'),
    getRepairOrderDetail,
);
router.post(
    '/',
    requireCapability(CAPABILITIES.REPAIR_ORDERS_CREATE),
    validate(createRepairOrderSchema),
    createRepairOrder,
);
router.patch(
    '/:id',
    requireCapability(CAPABILITIES.REPAIR_ORDERS_UPDATE),
    validate(repairOrderIdParamsSchema, 'params'),
    validate(updateRepairOrderSchema),
    updateRepairOrder,
);
router.delete(
    '/:id',
    requireCapability(CAPABILITIES.REPAIR_ORDERS_DELETE),
    validate(repairOrderIdParamsSchema, 'params'),
    deleteRepairOrder,
);
router.get(
    '/:id/pdf',
    requireCapability(CAPABILITIES.REPAIR_ORDERS_EXPORT),
    validate(repairOrderIdParamsSchema, 'params'),
    exportOrderPDF,
);

export default router;
