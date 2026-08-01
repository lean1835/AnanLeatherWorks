import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { ApiError } from '@common/utils/ApiError';
import {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
    R2_PUBLIC_DOMAIN,
} from '@config/environment';

const isR2Configured = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);

let s3Client: S3Client | null = null;

if (isR2Configured) {
    s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
    });
}

const LOCAL_UPLOADS_DIR = path.resolve(__dirname, '../../../uploads');

export interface UploadResult {
    objectKey: string;
    thumbnailKey: string;
    mimeType: string;
    fileSize: number;
}

const MAX_STORED_IMAGE_BYTES = 20 * 1024 * 1024;
const IMAGE_OBJECT_KEY_PATTERN = /^(?:[A-Za-z0-9][A-Za-z0-9_-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp)$/i;
const LOCAL_STREAM_PREFIXES = ['/api/repair-orders/stream/', '/api/repair-images/stream/'];

function safelyDecode(value: string): string | null {
    try {
        return decodeURIComponent(value);
    } catch {
        return null;
    }
}

function extractKeyFromTrustedUrl(rawUrl: string): string | null {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        return null;
    }

    const localPrefix = LOCAL_STREAM_PREFIXES.find((prefix) => url.pathname.startsWith(prefix));
    if (localPrefix) {
        return safelyDecode(url.pathname.slice(localPrefix.length));
    }

    if (R2_PUBLIC_DOMAIN) {
        try {
            const publicBase = new URL(R2_PUBLIC_DOMAIN);
            const basePath = publicBase.pathname.replace(/\/$/, '');
            if (url.origin === publicBase.origin && url.pathname.startsWith(`${basePath}/`)) {
                return safelyDecode(url.pathname.slice(basePath.length + 1));
            }
        } catch {
            return null;
        }
    }

    if (R2_ACCOUNT_ID) {
        const r2Origin = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
        if (url.origin === r2Origin) {
            const decodedPath = safelyDecode(url.pathname.replace(/^\/+/, ''));
            if (!decodedPath) return null;
            const bucketPrefix = `${R2_BUCKET_NAME}/`;
            return decodedPath.startsWith(bucketPrefix) ? decodedPath.slice(bucketPrefix.length) : decodedPath;
        }
    }

    return null;
}

export function normalizeImageObjectKey(input: unknown): string | null {
    let rawValue: unknown = input;
    if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
        rawValue = (rawValue as { objectKey?: unknown }).objectKey;
    }
    if (typeof rawValue !== 'string') return null;

    let key = rawValue.trim();
    if (!key || key.length > 512 || key.startsWith('data:')) return null;

    if (/^https?:\/\//i.test(key)) {
        const extracted = extractKeyFromTrustedUrl(key);
        if (!extracted) return null;
        key = extracted;
    } else {
        const localPrefix = LOCAL_STREAM_PREFIXES.find((prefix) => key.startsWith(prefix));
        if (localPrefix) {
            const decoded = safelyDecode(key.slice(localPrefix.length));
            if (!decoded) return null;
            key = decoded;
        }
    }

    if (
        !IMAGE_OBJECT_KEY_PATTERN.test(key) ||
        key.includes('\\') ||
        key.startsWith('/') ||
        key.split('/').some((segment) => segment === '.' || segment === '..')
    ) {
        return null;
    }

    return key;
}

function getLocalPathForKey(key: string): string | null {
    const normalizedKey = normalizeImageObjectKey(key);
    if (!normalizedKey) return null;
    const target = path.resolve(LOCAL_UPLOADS_DIR, normalizedKey.replace(/\//g, '_'));
    const relative = path.relative(LOCAL_UPLOADS_DIR, target);
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? target : null;
}

export class StorageService {
    public async uploadImage(buffer: Buffer, _originalMime: string, folder: string = 'repairs'): Promise<UploadResult> {
        if (!/^[A-Za-z0-9_-]+$/.test(folder)) {
            throw new Error('Thư mục lưu ảnh không hợp lệ');
        }
        if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > 15 * 1024 * 1024) {
            throw new Error('Kích thước ảnh tải lên không hợp lệ');
        }

        const timestamp = Date.now();
        const randomStr = crypto.randomBytes(8).toString('hex');
        const ext = 'jpg';

        const objectKey = `${folder}/${timestamp}_${randomStr}.${ext}`;
        const thumbnailKey = `${folder}/thumb_${timestamp}_${randomStr}.${ext}`;

        let mainBuffer: Buffer;
        let thumbBuffer: Buffer;
        try {
            const image = sharp(buffer, { limitInputPixels: 40_000_000, failOn: 'warning' }).rotate();
            await image.metadata();
            mainBuffer = await image
                .clone()
                .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 85 })
                .toBuffer();
            thumbBuffer = await image.clone().resize(400, 400, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
        } catch {
            throw new ApiError(400, 'Nội dung tệp không phải ảnh hợp lệ hoặc ảnh vượt giới hạn xử lý.');
        }

        const finalMime = 'image/jpeg';

        if (isR2Configured && s3Client) {
            let mainUploaded = false;
            try {
                await s3Client.send(
                    new PutObjectCommand({
                        Bucket: R2_BUCKET_NAME,
                        Key: objectKey,
                        Body: mainBuffer,
                        ContentType: finalMime,
                    }),
                );
                mainUploaded = true;
                await s3Client.send(
                    new PutObjectCommand({
                        Bucket: R2_BUCKET_NAME,
                        Key: thumbnailKey,
                        Body: thumbBuffer,
                        ContentType: finalMime,
                    }),
                );
            } catch (error) {
                if (mainUploaded) {
                    await s3Client
                        .send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: objectKey }))
                        .catch(() => undefined);
                }
                throw error;
            }
        } else {
            await fs.promises.mkdir(LOCAL_UPLOADS_DIR, { recursive: true });
            const mainPath = getLocalPathForKey(objectKey);
            const thumbPath = getLocalPathForKey(thumbnailKey);
            if (!mainPath || !thumbPath) throw new Error('Đường dẫn lưu ảnh không hợp lệ');
            try {
                await fs.promises.writeFile(mainPath, mainBuffer, { flag: 'wx' });
                await fs.promises.writeFile(thumbPath, thumbBuffer, { flag: 'wx' });
            } catch (error) {
                await fs.promises.unlink(mainPath).catch(() => undefined);
                await fs.promises.unlink(thumbPath).catch(() => undefined);
                throw error;
            }
        }

        return {
            objectKey,
            thumbnailKey,
            mimeType: finalMime,
            fileSize: mainBuffer.length,
        };
    }

    public async getImageUrl(key: string): Promise<string> {
        const normalizedKey = normalizeImageObjectKey(key);
        if (!normalizedKey) return '';

        if (isR2Configured && s3Client) {
            if (R2_PUBLIC_DOMAIN) {
                return `${R2_PUBLIC_DOMAIN.replace(/\/$/, '')}/${normalizedKey}`;
            }
            const command = new GetObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: normalizedKey,
            });
            return await getSignedUrl(s3Client, command, { expiresIn: 7200 });
        }

        return `/api/repair-orders/stream/${encodeURIComponent(normalizedKey)}`;
    }

    public async getImageBuffer(input: unknown): Promise<Buffer | null> {
        const key = normalizeImageObjectKey(input);
        if (!key) return null;

        try {
            if (isR2Configured && s3Client) {
                try {
                    const command = new GetObjectCommand({
                        Bucket: R2_BUCKET_NAME,
                        Key: key,
                    });
                    const response = await s3Client.send(command);
                    if (response.ContentLength && response.ContentLength > MAX_STORED_IMAGE_BYTES) return null;
                    if (response.Body) {
                        const byteArray = await response.Body.transformToByteArray();
                        return byteArray.length <= MAX_STORED_IMAGE_BYTES ? Buffer.from(byteArray) : null;
                    }
                } catch {
                    return null;
                }
            }

            const localPath = getLocalPathForKey(key);
            if (!localPath) return null;
            const stat = await fs.promises.lstat(localPath);
            if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_STORED_IMAGE_BYTES) return null;
            return await fs.promises.readFile(localPath);
        } catch {
            return null;
        }
    }

    public async deleteImage(objectKey: string, thumbnailKey?: string): Promise<void> {
        const normalizedObjectKey = normalizeImageObjectKey(objectKey);
        const normalizedThumbnailKey = thumbnailKey ? normalizeImageObjectKey(thumbnailKey) : null;
        if (!normalizedObjectKey) return;

        if (isR2Configured && s3Client) {
            await s3Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: normalizedObjectKey }));
            if (normalizedThumbnailKey) {
                await s3Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: normalizedThumbnailKey }));
            }
        } else {
            const mainPath = getLocalPathForKey(normalizedObjectKey);
            if (mainPath) {
                await fs.promises.unlink(mainPath).catch((error: NodeJS.ErrnoException) => {
                    if (error.code !== 'ENOENT') throw error;
                });
            }
            if (normalizedThumbnailKey) {
                const thumbPath = getLocalPathForKey(normalizedThumbnailKey);
                if (thumbPath) {
                    await fs.promises.unlink(thumbPath).catch((error: NodeJS.ErrnoException) => {
                        if (error.code !== 'ENOENT') throw error;
                    });
                }
            }
        }
    }
}

export const storageService = new StorageService();
