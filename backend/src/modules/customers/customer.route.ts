import { Router } from 'express';
import {
    getCustomerByPhone,
    getCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
} from './customer.controller';
import { authenticate } from '@common/middlewares/auth.middleware';
import { validate } from '@common/middlewares/validate.middleware';
import {
    createCustomerSchema,
    customerIdParamsSchema,
    customerPhoneParamsSchema,
    updateCustomerSchema,
} from './customer.validation';
import { requireCapability } from '@common/middlewares/capability.middleware';
import { CAPABILITIES } from '@config/capabilities';

const router = Router();

router.get('/', authenticate, requireCapability(CAPABILITIES.CUSTOMERS_VIEW), getCustomers);
router.get(
    '/by-phone/:phone',
    authenticate,
    requireCapability(CAPABILITIES.CUSTOMERS_VIEW),
    validate(customerPhoneParamsSchema, 'params'),
    getCustomerByPhone,
);
router.post(
    '/',
    authenticate,
    requireCapability(CAPABILITIES.CUSTOMERS_CREATE),
    validate(createCustomerSchema),
    createCustomer,
);
router.patch(
    '/:id',
    authenticate,
    requireCapability(CAPABILITIES.CUSTOMERS_UPDATE),
    validate(customerIdParamsSchema, 'params'),
    validate(updateCustomerSchema),
    updateCustomer,
);
router.delete(
    '/:id',
    authenticate,
    requireCapability(CAPABILITIES.CUSTOMERS_DELETE),
    validate(customerIdParamsSchema, 'params'),
    deleteCustomer,
);

export default router;
