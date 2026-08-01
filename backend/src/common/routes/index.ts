import { Router } from 'express';
import authRoutes from '@modules/auth/auth.route';
import customerRoutes from '@modules/customers/customer.route';
import repairOrderRoutes from '@modules/repair-orders/repairOrder.route';

const router = Router();

router.use('/auth', authRoutes);
router.use('/customers', customerRoutes);
router.use('/repair-orders', repairOrderRoutes);

export default router;
