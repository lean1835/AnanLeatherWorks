import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ApiError } from '@common/utils/ApiError';
import { JWT_AUDIENCE, JWT_ISSUER, JWT_SECRET } from '@config/environment';
import { IApiResponse } from '@common/interfaces/response.interface';
import User from './auth.model';
import { IUser } from '@common/interfaces/user.interface';
import { getInternalStaffCapabilities } from '@common/middlewares/capability.middleware';
import type { Capability } from '@config/capabilities';

type AuthResult = {
    user: {
        id: string;
        username: string;
        displayName: string;
        role: 'internal_staff';
        permissions: readonly Capability[];
    };
    token: string;
};

function signAccessToken(user: IUser, rememberMe: boolean = false): string {
    if (!JWT_SECRET) {
        throw new ApiError(500, 'Dịch vụ xác thực chưa được cấu hình.');
    }
    const expiresIn = rememberMe ? '90d' : '7d';
    return jwt.sign({ id: String(user._id), username: user.username }, JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
    });
}

function serializeUser(user: IUser): AuthResult['user'] {
    return {
        id: String(user._id),
        username: user.username,
        displayName: user.displayName,
        role: 'internal_staff',
        permissions: getInternalStaffCapabilities(),
    };
}

export class AuthService {
    public async login(
        username: string,
        password: string,
        rememberMe: boolean = false,
    ): Promise<IApiResponse<AuthResult>> {
        const user = await User.findOne({ username: username.toLowerCase().trim() }).select('+passwordHash');
        if (!user) {
            throw new ApiError(401, 'Tên đăng nhập hoặc mật khẩu không chính xác.');
        }

        if (!user.isActive) {
            throw new ApiError(403, 'Tài khoản đã bị khóa.');
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new ApiError(401, 'Tên đăng nhập hoặc mật khẩu không chính xác.');
        }

        const token = signAccessToken(user, rememberMe);

        return {
            success: true,
            message: 'Đăng nhập thành công.',
            data: {
                user: serializeUser(user),
                token,
            },
        };
    }

    public async register(payload: {
        username: string;
        password: string;
        displayName?: string;
    }): Promise<IApiResponse<AuthResult>> {
        const hasExistingUser = await User.exists({});
        if (hasExistingUser) {
            throw new ApiError(403, 'Bootstrap đã hoàn tất. Không thể đăng ký tài khoản công khai.');
        }
        const normalizedUsername = payload.username.toLowerCase().trim();

        const existingUser = await User.findOne({ username: normalizedUsername });
        if (existingUser) {
            throw new ApiError(400, 'Tên đăng nhập đã tồn tại. Vui lòng chọn tên khác.');
        }

        const passwordHash = await bcrypt.hash(payload.password, 10);
        const displayName = payload.displayName?.trim() || payload.username.trim();

        const newUser = await User.create({
            username: normalizedUsername,
            passwordHash,
            displayName,
            isActive: true,
        });

        const token = signAccessToken(newUser);

        return {
            success: true,
            message: 'Đăng ký tài khoản thành công.',
            data: {
                user: serializeUser(newUser),
                token,
            },
        };
    }
}

export const authService = new AuthService();
