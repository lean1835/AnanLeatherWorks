import { NextFunction, Response } from 'express';
import { Capability, INTERNAL_STAFF_CAPABILITIES } from '@config/capabilities';
import type { AuthRequest } from './auth.middleware';
import { ApiError } from '@common/utils/ApiError';

export function getInternalStaffCapabilities(): readonly Capability[] {
    return INTERNAL_STAFF_CAPABILITIES;
}

export const requireCapability = (capability: Capability) => {
    return (req: AuthRequest, _res: Response, next: NextFunction) => {
        if (!req.user) {
            return next(new ApiError(401, 'Vui lòng đăng nhập để thực hiện thao tác này.'));
        }

        const permissions = req.permissions || getInternalStaffCapabilities();
        if (!permissions.includes(capability)) {
            return next(new ApiError(403, 'Bạn không có quyền thực hiện thao tác này.'));
        }

        next();
    };
};
