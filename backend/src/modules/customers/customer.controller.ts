import { Request, Response } from 'express';
import { catchAsync } from '@common/utils/catchAsync';
import { customerService } from './customer.service';
import type { AuthRequest } from '@common/middlewares/auth.middleware';

export const getCustomers = catchAsync(async (req: Request, res: Response) => {
    const result = await customerService.getAll();
    res.status(200).json(result);
});

export const getCustomerByPhone = catchAsync(async (req: Request, res: Response) => {
    const phoneParam = String(req.params.phone || '').trim();
    const result = await customerService.getByPhone(phoneParam);
    res.status(200).json(result);
});

export const createCustomer = catchAsync(async (req: Request, res: Response) => {
    const result = await customerService.createCustomer(req.body);
    res.status(201).json(result);
});

export const updateCustomer = catchAsync(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const result = await customerService.updateCustomer(id, req.body, req.user!._id);
    res.status(200).json(result);
});

export const deleteCustomer = catchAsync(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const result = await customerService.deleteCustomer(id, req.user!._id);
    res.status(200).json(result);
});
