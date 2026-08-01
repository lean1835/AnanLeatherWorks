import 'dotenv/config';
import fs from 'node:fs';

const errors = [];
const environment = process.env.NODE_ENV || 'development';
const production = environment === 'production';

const placeholderPattern = /(replace[_-]?with|your[_-]|change[_-]?me|example|admin123)/i;
const localAddressPattern = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i;
const cookieSameSite = process.env.COOKIE_SAME_SITE?.trim().toLowerCase() || 'strict';

function requireValue(name, minimumLength = 1) {
    const value = process.env[name]?.trim() || '';

    if (!value) {
        errors.push(`${name} is required`);
    } else if (value.length < minimumLength) {
        errors.push(`${name} must contain at least ${minimumLength} characters`);
    } else if (placeholderPattern.test(value)) {
        errors.push(`${name} still contains a placeholder value`);
    }

    return value;
}

const port = Number(process.env.PORT || 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push('PORT must be an integer between 1 and 65535');
}
if (!['strict', 'lax', 'none'].includes(cookieSameSite)) {
    errors.push('COOKIE_SAME_SITE must be strict, lax, or none');
}
if (cookieSameSite === 'none' && !production) {
    errors.push('COOKIE_SAME_SITE=none requires production HTTPS');
}

if (production) {
    const mongoUri = requireValue('MONGODB_URI', 16);
    const jwtSecret = requireValue('JWT_SECRET', 32);
    const cookieSecret = requireValue('COOKIE_SECRET', 32);

    requireValue('R2_ACCOUNT_ID', 16);
    requireValue('R2_ACCESS_KEY_ID', 16);
    requireValue('R2_SECRET_ACCESS_KEY', 32);
    requireValue('R2_BUCKET_NAME', 3);

    const corsOrigins = requireValue('CORS_ORIGINS', 8)
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

    if (mongoUri && !/^mongodb(?:\+srv)?:\/\//i.test(mongoUri)) {
        errors.push('MONGODB_URI must use mongodb:// or mongodb+srv://');
    }
    if (/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(mongoUri)) {
        errors.push('MONGODB_URI must not target a local address in production');
    }
    if (jwtSecret && cookieSecret && jwtSecret === cookieSecret) {
        errors.push('JWT_SECRET and COOKIE_SECRET must be different values');
    }
    if (process.env.ENABLE_DEV_SEED?.trim().toLowerCase() === 'true') {
        errors.push('ENABLE_DEV_SEED must not be enabled in production');
    }

    for (const origin of corsOrigins) {
        if (origin === '*' || localAddressPattern.test(origin)) {
            errors.push('CORS_ORIGINS must not contain wildcards or local addresses in production');
            continue;
        }
        try {
            const parsedOrigin = new URL(origin);
            if (parsedOrigin.protocol !== 'https:') {
                errors.push('Every CORS_ORIGINS entry must use HTTPS in production');
            } else if (parsedOrigin.origin !== origin) {
                errors.push('Every CORS_ORIGINS entry must be an origin without a path, query, or trailing slash');
            }
        } catch {
            errors.push('Every CORS_ORIGINS entry must be a valid origin');
        }
    }

    const bootstrapToken = process.env.AUTH_BOOTSTRAP_TOKEN?.trim() || '';
    if (bootstrapToken && (bootstrapToken.length < 32 || placeholderPattern.test(bootstrapToken))) {
        errors.push('AUTH_BOOTSTRAP_TOKEN must be a non-placeholder value of at least 32 characters when enabled');
    }

    const publicDomain = process.env.R2_PUBLIC_DOMAIN?.trim();
    if (publicDomain) {
        if (placeholderPattern.test(publicDomain) || localAddressPattern.test(publicDomain)) {
            errors.push('R2_PUBLIC_DOMAIN must not contain a placeholder or local address in production');
        } else {
            try {
                const parsedDomain = new URL(publicDomain);
                if (parsedDomain.protocol !== 'https:') {
                    errors.push('R2_PUBLIC_DOMAIN must use HTTPS in production');
                }
            } catch {
                errors.push('R2_PUBLIC_DOMAIN must be a valid URL when provided');
            }
        }
    }
}

const trustProxy = process.env.TRUST_PROXY?.trim().toLowerCase() || 'false';
if (!/^(?:false|true|\d+)$/.test(trustProxy)) {
    errors.push('TRUST_PROXY must be false, true, or a non-negative hop count');
}

const pdfFontRegular = process.env.PDF_FONT_REGULAR?.trim() || '';
const pdfFontBold = process.env.PDF_FONT_BOLD?.trim() || '';
if (Boolean(pdfFontRegular) !== Boolean(pdfFontBold)) {
    errors.push('PDF_FONT_REGULAR and PDF_FONT_BOLD must be configured together');
} else if (pdfFontRegular && pdfFontBold) {
    try {
        fs.accessSync(pdfFontRegular, fs.constants.R_OK);
        fs.accessSync(pdfFontBold, fs.constants.R_OK);
    } catch {
        errors.push('PDF_FONT_REGULAR/PDF_FONT_BOLD must point to readable files');
    }
}

if (errors.length > 0) {
    console.error(`Environment validation failed:\n- ${errors.join('\n- ')}`);
    process.exit(1);
}

console.log(`Environment validation passed for ${environment}.`);
