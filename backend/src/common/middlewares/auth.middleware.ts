import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_AUDIENCE, JWT_ISSUER, JWT_SECRET } from '@config/environment';
import { ApiError } from '@common/utils/ApiError';
import User from '@modules/auth/auth.model';
import { IUser } from '@common/interfaces/user.interface';
import type { Capability } from '@config/capabilities';
import { getInternalStaffCapabilities } from './capability.middleware';

export interface AuthRequest extends Request {
    user?: IUser;
    permissions?: readonly Capability[];
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        // Accept one legacy unsigned cookie during rollout; newly issued cookies are
        // signed whenever COOKIE_SECRET is configured.
        let token = req.signedCookies?.token || req.cookies?.token;

        if (!token && req.headers.authorization?.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token && typeof req.query.token === 'string' && req.query.token.trim()) {
            token = req.query.token.trim();
        }

        if (!token) {
            return next(new ApiError(401, 'Vui lòng đăng nhập để thực hiện thao tác này.'));
        }

        if (!JWT_SECRET) {
            return next(new ApiError(500, 'Dịch vụ xác thực chưa được cấu hình.'));
        }

        const decoded = jwt.verify(token, JWT_SECRET, {
            algorithms: ['HS256'],
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        }) as {
            id?: unknown;
            username?: unknown;
        };
        if (typeof decoded.id !== 'string' || !decoded.id) {
            return next(new ApiError(401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'));
        }
        const user = await User.findById(decoded.id);

        if (!user || !user.isActive) {
            return next(new ApiError(401, 'Tài khoản không tồn tại hoặc đã bị khóa.'));
        }

        req.user = user;
        req.permissions = getInternalStaffCapabilities();
        next();
    } catch {
        return next(new ApiError(401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'));
    }
};
