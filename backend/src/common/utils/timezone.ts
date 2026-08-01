const VIETNAM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface MonthYear {
    month: number;
    year: number;
}

export function getVietnamMonthYear(date: Date = new Date()): MonthYear {
    const shifted = new Date(date.getTime() + VIETNAM_UTC_OFFSET_MS);
    return {
        month: shifted.getUTCMonth() + 1,
        year: shifted.getUTCFullYear(),
    };
}

export function vietnamStartOfMonthUtc(year: number, month: number): Date {
    return new Date(Date.UTC(year, month - 1, 1) - VIETNAM_UTC_OFFSET_MS);
}

export function vietnamEndOfMonthUtc(year: number, month: number): Date {
    return new Date(vietnamStartOfMonthUtc(year, month + 1).getTime() - 1);
}

export function addVietnamMonths(year: number, month: number, delta: number): MonthYear {
    const zeroBased = year * 12 + (month - 1) + delta;
    return {
        year: Math.floor(zeroBased / 12),
        month: (((zeroBased % 12) + 12) % 12) + 1,
    };
}

/** Parse a business date without letting the host machine timezone change its day. */
export function parseVietnamBusinessDate(value: unknown, endOfDay = false): Date {
    if (value instanceof Date) return new Date(value.getTime());

    if (typeof value === 'string') {
        const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
        if (dateOnly) {
            const year = Number(dateOnly[1]);
            const month = Number(dateOnly[2]);
            const day = Number(dateOnly[3]);
            const hour = endOfDay ? 23 : 0;
            const minute = endOfDay ? 59 : 0;
            const second = endOfDay ? 59 : 0;
            const millisecond = endOfDay ? 999 : 0;
            const utc = Date.UTC(year, month - 1, day, hour - 7, minute, second, millisecond);
            const parsed = new Date(utc);
            const vietnamView = new Date(parsed.getTime() + VIETNAM_UTC_OFFSET_MS);
            if (
                vietnamView.getUTCFullYear() !== year ||
                vietnamView.getUTCMonth() + 1 !== month ||
                vietnamView.getUTCDate() !== day
            ) {
                return new Date(Number.NaN);
            }
            return parsed;
        }
    }

    return new Date(value as string | number);
}
