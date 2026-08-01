import { Request, Response, NextFunction } from 'express';

const SENSITIVE_STRING_FIELDS = new Set(['password', 'token', 'accessToken', 'refreshToken']);
const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function trimObject(obj: unknown, parentKey = ''): unknown {
    if (obj === null || typeof obj !== 'object') {
        if (typeof obj === 'string') {
            return SENSITIVE_STRING_FIELDS.has(parentKey) ? obj : obj.trim();
        }
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map((item) => trimObject(item, parentKey));
    }

    const trimmed: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        if (UNSAFE_OBJECT_KEYS.has(key)) continue;
        trimmed[key] = trimObject(value, key);
    }
    return trimmed;
}

export const trimRequest = (req: Request, _res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === 'object') {
        req.body = trimObject(req.body);
    }
    next();
};
