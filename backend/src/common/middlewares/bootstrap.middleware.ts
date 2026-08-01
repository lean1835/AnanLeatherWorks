import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { AUTH_BOOTSTRAP_TOKEN } from '@config/environment';
import { ApiError } from '@common/utils/ApiError';

function safeEqual(left: string, right: string): boolean {
    const leftDigest = crypto.createHash('sha256').update(left).digest();
    const rightDigest = crypto.createHash('sha256').update(right).digest();
    return crypto.timingSafeEqual(leftDigest, rightDigest);
}

export const requireBootstrapToken = (req: Request, _res: Response, next: NextFunction) => {
    const supplied = String(req.headers['x-bootstrap-token'] || '');
    if (!AUTH_BOOTSTRAP_TOKEN || !supplied || !safeEqual(supplied, AUTH_BOOTSTRAP_TOKEN)) {
        return next(new ApiError(403, 'Đăng ký tài khoản công khai đã bị vô hiệu hóa.'));
    }
    next();
};
