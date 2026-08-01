import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const NODE_ENV: string = process.env.NODE_ENV?.trim().toLowerCase() || 'development';
export const PORT: number = parseInt(process.env.PORT?.trim() || '5000', 10);
export const MONGODB_URI: string = process.env.MONGODB_URI?.trim() || 'mongodb://127.0.0.1:27017/ananleather_works';
export const JWT_SECRET: string = process.env.JWT_SECRET?.trim() || '';
export const JWT_ISSUER = 'ananleather-works-api';
export const JWT_AUDIENCE = 'ananleather-works-web';
export const COOKIE_SECRET: string = process.env.COOKIE_SECRET?.trim() || '';
export type CookieSameSite = 'strict' | 'lax' | 'none';
const rawCookieSameSite = process.env.COOKIE_SAME_SITE?.trim().toLowerCase() || 'strict';
export const COOKIE_SAME_SITE: CookieSameSite = ['strict', 'lax', 'none'].includes(rawCookieSameSite)
    ? (rawCookieSameSite as CookieSameSite)
    : 'strict';
export const AUTH_BOOTSTRAP_TOKEN: string = process.env.AUTH_BOOTSTRAP_TOKEN?.trim() || '';
export const ENABLE_DEV_SEED: boolean = process.env.ENABLE_DEV_SEED?.trim().toLowerCase() === 'true';
export const APP_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const BUSINESS_NAME = process.env.BUSINESS_NAME?.trim() || 'ANAN LEATHER';
export const BUSINESS_HOTLINE = process.env.BUSINESS_HOTLINE?.trim() || '0969.911.678';
export const BUSINESS_WEBSITE = process.env.BUSINESS_WEBSITE?.trim() || 'www.ananleatherworks.vn';
export const BUSINESS_LOCATION = process.env.BUSINESS_LOCATION?.trim() || 'Thái Nguyên';
export const PDF_FONT_REGULAR = process.env.PDF_FONT_REGULAR?.trim() || '';
export const PDF_FONT_BOLD = process.env.PDF_FONT_BOLD?.trim() || '';

export const CORS_ORIGINS: string[] = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

export const TRUST_PROXY: boolean | number = (() => {
    const value = process.env.TRUST_PROXY?.trim().toLowerCase();
    if (!value) return false;
    if (value === 'true') return 1;
    if (/^\d+$/.test(value)) return Number(value);
    return false;
})();

export const R2_ACCOUNT_ID: string = process.env.R2_ACCOUNT_ID?.trim() || '';
export const R2_ACCESS_KEY_ID: string = process.env.R2_ACCESS_KEY_ID?.trim() || '';
export const R2_SECRET_ACCESS_KEY: string = process.env.R2_SECRET_ACCESS_KEY?.trim() || '';
export const R2_BUCKET_NAME: string = process.env.R2_BUCKET_NAME?.trim() || 'ananleather-works-images';
export const R2_PUBLIC_DOMAIN: string = process.env.R2_PUBLIC_DOMAIN?.trim() || '';

export function validateEnvironment(): void {
    const errors: string[] = [];
    const production = NODE_ENV === 'production';
    const placeholderPattern = /(replace[_-]?with|your[_-]|change[_-]?me|example|admin123)/i;
    const localAddressPattern = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i;

    const rawPort = process.env.PORT?.trim() || '5000';
    if (!/^\d+$/.test(rawPort) || !Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
        errors.push('PORT phải là số nguyên từ 1 đến 65535');
    }
    if (!['development', 'test', 'production'].includes(NODE_ENV)) {
        errors.push('NODE_ENV phải là development, test hoặc production');
    }
    if (!JWT_SECRET || JWT_SECRET.length < 32) {
        errors.push('JWT_SECRET bắt buộc và phải có ít nhất 32 ký tự');
    }
    if (AUTH_BOOTSTRAP_TOKEN && AUTH_BOOTSTRAP_TOKEN.length < 32) {
        errors.push('AUTH_BOOTSTRAP_TOKEN phải có ít nhất 32 ký tự nếu được bật');
    }
    if (!['strict', 'lax', 'none'].includes(rawCookieSameSite)) {
        errors.push('COOKIE_SAME_SITE phải là strict, lax hoặc none');
    }
    if (COOKIE_SAME_SITE === 'none' && !production) {
        errors.push('COOKIE_SAME_SITE=none chỉ hợp lệ trong production HTTPS');
    }

    const rawTrustProxy = process.env.TRUST_PROXY?.trim().toLowerCase() || 'false';
    if (!/^(?:false|true|\d+)$/.test(rawTrustProxy)) {
        errors.push('TRUST_PROXY phải là false, true hoặc số hop không âm');
    }
    const rawSeedFlag = process.env.ENABLE_DEV_SEED?.trim().toLowerCase();
    if (rawSeedFlag && !/^(?:true|false)$/.test(rawSeedFlag)) {
        errors.push('ENABLE_DEV_SEED phải là true hoặc false');
    }

    if (Boolean(PDF_FONT_REGULAR) !== Boolean(PDF_FONT_BOLD)) {
        errors.push('PDF_FONT_REGULAR và PDF_FONT_BOLD phải được cấu hình cùng nhau');
    } else if (PDF_FONT_REGULAR && PDF_FONT_BOLD) {
        try {
            fs.accessSync(PDF_FONT_REGULAR, fs.constants.R_OK);
            fs.accessSync(PDF_FONT_BOLD, fs.constants.R_OK);
        } catch {
            errors.push('PDF_FONT_REGULAR/PDF_FONT_BOLD phải trỏ đến file có thể đọc');
        }
    }

    for (const origin of CORS_ORIGINS) {
        try {
            const parsed = new URL(origin);
            if (origin === '*' || parsed.origin !== origin) {
                errors.push(`CORS_ORIGINS chỉ được chứa origin hợp lệ, không chứa wildcard/path: ${origin}`);
            }
        } catch {
            errors.push(`CORS origin không hợp lệ: ${origin}`);
        }
    }

    const configuredR2Credentials = [R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY].filter(Boolean).length;
    if (configuredR2Credentials > 0 && configuredR2Credentials < 3) {
        errors.push('R2_ACCOUNT_ID, R2_ACCESS_KEY_ID và R2_SECRET_ACCESS_KEY phải được cấu hình đồng thời');
    }
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/i.test(R2_BUCKET_NAME)) {
        errors.push('R2_BUCKET_NAME không hợp lệ');
    }
    if (R2_PUBLIC_DOMAIN) {
        try {
            const publicDomain = new URL(R2_PUBLIC_DOMAIN);
            if (!/^https?:$/.test(publicDomain.protocol)) errors.push('R2_PUBLIC_DOMAIN phải dùng HTTP hoặc HTTPS');
        } catch {
            errors.push('R2_PUBLIC_DOMAIN không phải URL hợp lệ');
        }
    }

    if (production) {
        const mongoUri = process.env.MONGODB_URI?.trim() || '';
        if (!mongoUri || !/^mongodb(?:\+srv)?:\/\//i.test(mongoUri)) {
            errors.push('MONGODB_URI production phải dùng mongodb:// hoặc mongodb+srv://');
        } else if (localAddressPattern.test(mongoUri)) {
            errors.push('MONGODB_URI production không được trỏ đến địa chỉ local');
        }

        if (!COOKIE_SECRET || COOKIE_SECRET.length < 32) {
            errors.push('COOKIE_SECRET bắt buộc trong production và phải có ít nhất 32 ký tự');
        }
        if (JWT_SECRET === COOKIE_SECRET) {
            errors.push('JWT_SECRET và COOKIE_SECRET phải là hai giá trị khác nhau');
        }
        if (placeholderPattern.test(JWT_SECRET) || placeholderPattern.test(COOKIE_SECRET)) {
            errors.push('JWT_SECRET/COOKIE_SECRET không được dùng giá trị placeholder');
        }
        if (ENABLE_DEV_SEED) {
            errors.push('ENABLE_DEV_SEED không được bật trong production');
        }

        if (CORS_ORIGINS.length === 0) {
            errors.push('CORS_ORIGINS bắt buộc trong production');
        }
        for (const origin of CORS_ORIGINS) {
            try {
                const parsed = new URL(origin);
                if (parsed.protocol !== 'https:' || localAddressPattern.test(origin)) {
                    errors.push(`CORS origin không an toàn trong production: ${origin}`);
                }
            } catch {
                // The general validation above already reports the malformed value.
            }
        }

        const requiredR2Values: Array<[string, string, number]> = [
            ['R2_ACCOUNT_ID', R2_ACCOUNT_ID, 16],
            ['R2_ACCESS_KEY_ID', R2_ACCESS_KEY_ID, 16],
            ['R2_SECRET_ACCESS_KEY', R2_SECRET_ACCESS_KEY, 32],
            ['R2_BUCKET_NAME', process.env.R2_BUCKET_NAME?.trim() || '', 3],
        ];
        for (const [name, value, minLength] of requiredR2Values) {
            if (!value || value.length < minLength || placeholderPattern.test(value)) {
                errors.push(`${name} bắt buộc trong production và không được là placeholder`);
            }
        }

        if (AUTH_BOOTSTRAP_TOKEN && placeholderPattern.test(AUTH_BOOTSTRAP_TOKEN)) {
            errors.push('AUTH_BOOTSTRAP_TOKEN không được dùng giá trị placeholder');
        }
        if (R2_PUBLIC_DOMAIN) {
            try {
                if (new URL(R2_PUBLIC_DOMAIN).protocol !== 'https:') {
                    errors.push('R2_PUBLIC_DOMAIN phải dùng HTTPS trong production');
                }
            } catch {
                // The general validation above already reports the malformed value.
            }
        }
    }

    if (errors.length > 0) {
        throw new Error(`Cấu hình môi trường không hợp lệ: ${errors.join('; ')}`);
    }
}
