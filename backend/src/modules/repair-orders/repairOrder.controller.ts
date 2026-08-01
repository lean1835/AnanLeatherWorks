import { Request, Response } from 'express';
import { catchAsync } from '@common/utils/catchAsync';
import { AuthRequest } from '@common/middlewares/auth.middleware';
import { repairOrderService } from './repairOrder.service';
import { normalizeImageObjectKey, storageService } from '@common/services/r2.service';
import { ApiError } from '@common/utils/ApiError';
import type { RepairOrderStatus } from '@common/interfaces/repairOrder.interface';

export const getDashboardStats = catchAsync(async (req: AuthRequest, res: Response) => {
    const result = await repairOrderService.getDashboardStats();
    res.status(200).json(result);
});

export const getRepairOrders = catchAsync(async (req: AuthRequest, res: Response) => {
    const query = {
        page: req.query.page ? parseInt(String(req.query.page), 10) : 1,
        limit: req.query.limit ? parseInt(String(req.query.limit), 10) : 10,
        status: req.query.status ? (String(req.query.status) as RepairOrderStatus) : undefined,
        search: req.query.search ? String(req.query.search) : undefined,
    };
    const result = await repairOrderService.getOrders(query);
    res.status(200).json(result);
});

export const getRepairOrderDetail = catchAsync(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const result = await repairOrderService.getOrderDetail(id);
    res.status(200).json(result);
});

export const createRepairOrder = catchAsync(async (req: AuthRequest, res: Response) => {
    const result = await repairOrderService.createOrder(req.body, req.user!._id);
    res.status(201).json(result);
});

export const updateRepairOrder = catchAsync(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const result = await repairOrderService.updateOrder(id, req.body, req.user!._id);
    res.status(200).json(result);
});

function sanitizeHeaderFilename(filename: string): string {
    const ascii = filename
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/[^\x20-\x7E]/g, '');
    return ascii || 'Phieu-sua-AnanLeather-Works.pdf';
}

export const exportOrderPDF = catchAsync(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const { buffer, filename } = await repairOrderService.generatePDFBuffer(id);

    const safeAscii = sanitizeHeaderFilename(filename);
    const encodedUtf8 = encodeURIComponent(filename);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Disposition', `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodedUtf8}`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
});

export const exportCustomerPDF = catchAsync(async (req: AuthRequest, res: Response) => {
    const customerId = String(req.params.customerId);
    const month = req.query.month ? parseInt(String(req.query.month), 10) : undefined;
    const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
    const { buffer, filename } = await repairOrderService.generateCustomerPDFBuffer(customerId, month, year);

    const safeAscii = sanitizeHeaderFilename(filename);
    const encodedUtf8 = encodeURIComponent(filename);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Disposition', `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodedUtf8}`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
});

export const getByCustomerGroup = catchAsync(async (req: AuthRequest, res: Response) => {
    const query = {
        month: req.query.month ? parseInt(String(req.query.month), 10) : undefined,
        year: req.query.year ? parseInt(String(req.query.year), 10) : undefined,
        search: req.query.search ? String(req.query.search) : undefined,
        customerId: req.query.customerId ? String(req.query.customerId) : undefined,
    };
    const result = await repairOrderService.getOrdersByCustomerGroup(query);
    res.status(200).json(result);
});

export const deleteRepairOrder = catchAsync(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const result = await repairOrderService.deleteOrder(id, req.user!._id);
    res.status(200).json(result);
});

export const deleteUnreferencedImage = catchAsync(async (req: AuthRequest, res: Response) => {
    const result = await repairOrderService.deleteUnreferencedImage(req.params.key);
    res.status(200).json(result);
});

export const uploadOrderImage = catchAsync(async (req: AuthRequest, res: Response) => {
    if (!req.file) {
        throw new ApiError(400, 'Không tìm thấy tệp ảnh tải lên.');
    }
    const uploadRes = await storageService.uploadImage(req.file.buffer, req.file.mimetype, 'repairs');
    const url = await storageService.getImageUrl(uploadRes.objectKey);
    const thumbnailUrl = await storageService.getImageUrl(uploadRes.thumbnailKey);

    res.status(201).json({
        success: true,
        message: 'Tải ảnh lên thành công',
        data: {
            objectKey: uploadRes.objectKey,
            thumbnailKey: uploadRes.thumbnailKey,
            url,
            thumbnailUrl,
            stage: req.body.stage === 'after' ? 'after' : 'before',
        },
    });
});

export const streamImage = catchAsync(async (req: Request, res: Response) => {
    const key = normalizeImageObjectKey(String(req.params.key || ''));
    if (!key) throw new ApiError(400, 'Khóa ảnh không hợp lệ.');

    const buffer = await storageService.getImageBuffer(key);
    if (!buffer) throw new ApiError(404, 'Không tìm thấy ảnh.');

    const extension = key.split('.').pop()?.toLowerCase();
    const contentType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
});
