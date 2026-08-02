import { Request, Response } from 'express';
import { catchAsync } from '@common/utils/catchAsync';
import { AuthRequest } from '@common/middlewares/auth.middleware';
import { COOKIE_SAME_SITE, COOKIE_SECRET, NODE_ENV } from '@config/environment';
import { authService } from './auth.service';
import { recordFailedLogin, recordSuccessfulLogin } from '@common/middlewares/rateLimiter.middleware';
import { getInternalStaffCapabilities } from '@common/middlewares/capability.middleware';

const authCookieOptions = {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: COOKIE_SAME_SITE,
    path: '/',
    signed: Boolean(COOKIE_SECRET),
    maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const login = catchAsync(async (req: Request, res: Response) => {
    const { username, password, rememberMe } = req.body;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    try {
        const isRemember = Boolean(rememberMe);
        const result = await authService.login(username, password, isRemember);
        recordSuccessfulLogin(ip, username);

        const maxAge = isRemember ? 90 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
        res.cookie('token', result.data!.token, {
            ...authCookieOptions,
            maxAge,
        });
        res.status(200).json(result);
    } catch (error) {
        recordFailedLogin(ip, username);
        throw error;
    }
});

export const register = catchAsync(async (req: Request, res: Response) => {
    const { username, password, displayName } = req.body;
    const result = await authService.register({ username, password, displayName });

    res.cookie('token', result.data!.token, authCookieOptions);
    res.status(201).json(result);
});

export const logout = catchAsync(async (req: Request, res: Response) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: NODE_ENV === 'production',
        sameSite: COOKIE_SAME_SITE,
        path: '/',
        signed: Boolean(COOKIE_SECRET),
    });
    res.status(200).json({
        success: true,
        message: 'Đăng xuất thành công.',
    });
});

export const getMe = catchAsync(async (req: AuthRequest, res: Response) => {
    const permissions = [...(req.permissions || getInternalStaffCapabilities())];
    res.status(200).json({
        success: true,
        message: 'Lấy thông tin tài khoản thành công.',
        data: {
            user: {
                id: req.user!._id,
                username: req.user!.username,
                displayName: req.user!.displayName,
                role: 'internal_staff',
                permissions,
            },
            // Alias tương thích với client cũ từng đọc data.permissions.
            permissions,
        },
    });
});
