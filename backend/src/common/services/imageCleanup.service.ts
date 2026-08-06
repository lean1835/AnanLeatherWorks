import RepairOrder from '@modules/repair-orders/repairOrder.model';
import { R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_PUBLIC_DOMAIN } from '@config/environment';
import { normalizeImageObjectKey, storageService } from '@common/services/r2.service';
import { logger } from '@common/utils/logger';

const CLEANUP_CONCURRENCY = 4;

type ReferenceFilter = {
    $or: Array<{
        images?: { $in: Array<string | RegExp> };
    }>;
};

export interface ImageCleanupResult {
    deleted: string[];
    referenced: string[];
    failures: Array<{ objectKey: string; error: unknown }>;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function deriveThumbnailKey(objectKey: string): string | undefined {
    const slashIndex = objectKey.lastIndexOf('/');
    const folder = slashIndex >= 0 ? objectKey.slice(0, slashIndex + 1) : '';
    const filename = slashIndex >= 0 ? objectKey.slice(slashIndex + 1) : objectKey;
    return filename.startsWith('thumb_') ? undefined : `${folder}thumb_${filename}`;
}

function addTrustedUrlPatterns(patterns: Array<string | RegExp>, objectKey: string): void {
    const escapedKey = escapeRegExp(objectKey);
    const encodedKey = escapeRegExp(encodeURIComponent(objectKey));
    const keyPath = `(?:${escapedKey}|${encodedKey})`;

    // Relative and absolute forms returned by the legacy authenticated stream.
    patterns.push(
        new RegExp(`^/api/(?:repair-orders|repair-images)/stream/${keyPath}(?:\\?.*)?$`),
        new RegExp(`^https?://[^/]+/api/(?:repair-orders|repair-images)/stream/${keyPath}(?:\\?.*)?$`),
    );

    if (R2_PUBLIC_DOMAIN) {
        const publicBase = escapeRegExp(R2_PUBLIC_DOMAIN.replace(/\/$/, ''));
        patterns.push(new RegExp(`^${publicBase}/${keyPath}(?:\\?.*)?$`));
    }

    if (R2_ACCOUNT_ID) {
        const r2Origin = escapeRegExp(`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
        const bucket = escapeRegExp(R2_BUCKET_NAME);
        patterns.push(new RegExp(`^${r2Origin}/${bucket}/${keyPath}(?:\\?.*)?$`));
    }
}

export function buildImageReferenceFilter(objectKey: string): ReferenceFilter {
    const normalizedKey = normalizeImageObjectKey(objectKey);
    if (!normalizedKey) return { $or: [] };

    const encodedKey = encodeURIComponent(normalizedKey);
    const candidates: Array<string | RegExp> = [
        normalizedKey,
        `/api/repair-orders/stream/${encodedKey}`,
        `/api/repair-images/stream/${encodedKey}`,
    ];
    addTrustedUrlPatterns(candidates, normalizedKey);

    return {
        $or: [
            { images: { $in: candidates } },
        ],
    };
}

export async function isImageReferenced(objectKey: string): Promise<boolean> {
    const filter = buildImageReferenceFilter(objectKey);
    if (filter.$or.length === 0) return false;
    return Boolean(await RepairOrder.exists(filter));
}

export async function cleanupUnreferencedImages(keys: Iterable<unknown>): Promise<ImageCleanupResult> {
    const uniqueKeys = Array.from(
        new Set(
            Array.from(keys)
                .map((key) => normalizeImageObjectKey(key))
                .filter((key): key is string => Boolean(key)),
        ),
    );
    const result: ImageCleanupResult = { deleted: [], referenced: [], failures: [] };
    let cursor = 0;

    const workers = Array.from({ length: Math.min(CLEANUP_CONCURRENCY, uniqueKeys.length) }, async () => {
        while (cursor < uniqueKeys.length) {
            const objectKey = uniqueKeys[cursor++];
            try {
                if (await isImageReferenced(objectKey)) {
                    result.referenced.push(objectKey);
                    continue;
                }
                await storageService.deleteImage(objectKey, deriveThumbnailKey(objectKey));
                result.deleted.push(objectKey);
            } catch (error) {
                result.failures.push({ objectKey, error });
                logger.warn(`Không thể dọn ảnh không còn được tham chiếu: ${objectKey}`);
            }
        }
    });

    await Promise.all(workers);
    return result;
}
