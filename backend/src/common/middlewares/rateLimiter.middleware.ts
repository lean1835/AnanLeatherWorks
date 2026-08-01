import { Request, Response, NextFunction } from 'express';
import { ApiError } from '@common/utils/ApiError';

interface LoginAttempt {
    count: number;
    lockUntil?: number;
    lastSeen: number;
}

const loginAttempts = new Map<string, LoginAttempt>();
const MAX_TRACKED_ATTEMPTS = 10_000;
const RECORD_TTL_MS = 30 * 60 * 1000;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const ACCOUNT_FAILURE_LIMIT = 5;
const IP_FAILURE_LIMIT = 25;
let lastPruneAt = 0;

function normalizeUsername(username: string): string {
    return username.toLowerCase().trim().slice(0, 64);
}

function getAttemptKeys(ip: string, username: string): Array<{ key: string; limit: number }> {
    return [
        { key: `ip:${ip.slice(0, 128)}`, limit: IP_FAILURE_LIMIT },
        { key: `account:${normalizeUsername(username)}`, limit: ACCOUNT_FAILURE_LIMIT },
    ];
}

function pruneExpiredAttempts(now: number): void {
    if (now - lastPruneAt >= 60_000) {
        for (const [key, record] of loginAttempts) {
            if ((!record.lockUntil || record.lockUntil <= now) && now - record.lastSeen > RECORD_TTL_MS) {
                loginAttempts.delete(key);
            }
        }
        lastPruneAt = now;
    }

    while (loginAttempts.size > MAX_TRACKED_ATTEMPTS) {
        const oldestKey = loginAttempts.keys().next().value as string | undefined;
        if (!oldestKey) break;
        loginAttempts.delete(oldestKey);
    }
}

export const loginRateLimiter = (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const username = typeof req.body?.username === 'string' ? req.body.username : '';
    const now = Date.now();
    pruneExpiredAttempts(now);

    let longestRemainingMs = 0;
    for (const { key } of getAttemptKeys(ip, username)) {
        const record = loginAttempts.get(key);
        if (!record) continue;
        record.lastSeen = now;
        if (record.lockUntil && record.lockUntil > now) {
            longestRemainingMs = Math.max(longestRemainingMs, record.lockUntil - now);
        } else if (record.lockUntil) {
            record.count = 0;
            delete record.lockUntil;
        }
        loginAttempts.delete(key);
        loginAttempts.set(key, record);
    }

    if (longestRemainingMs > 0) {
        const remainingSecs = Math.ceil(longestRemainingMs / 1000);
        return next(new ApiError(429, `Thao tác quá nhiều lần. Vui lòng thử lại sau ${remainingSecs} giây.`));
    }
    next();
};

export const recordFailedLogin = (ip: string, username: string) => {
    const now = Date.now();
    for (const { key, limit } of getAttemptKeys(ip, username)) {
        const record = loginAttempts.get(key) || { count: 0, lastSeen: now };
        record.count += 1;
        record.lastSeen = now;
        if (record.count >= limit) record.lockUntil = now + LOCK_DURATION_MS;
        loginAttempts.delete(key);
        loginAttempts.set(key, record);
    }
    pruneExpiredAttempts(now);
};

export const recordSuccessfulLogin = (ip: string, username: string) => {
    // Reset the account bucket after a valid login, but retain the IP bucket so an
    // attacker cannot erase distributed username failures with one known account.
    loginAttempts.delete(`account:${normalizeUsername(username)}`);
};
