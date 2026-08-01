import { Request, Response, NextFunction } from 'express';
import { ApiError } from '@common/utils/ApiError';
import { logger } from '@common/utils/logger';
import multer from 'multer';

function isErrorRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function getValidationMessage(value: unknown): string | null {
    return isErrorRecord(value) && typeof value.message === 'string' ? value.message : null;
}

export const errorHandler = (err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);

    let statusCode = 500;
    let message = 'Đã xảy ra lỗi máy chủ nội bộ.';

    if (err instanceof ApiError) {
        statusCode = err.statusCode;
        message = err.message;
    } else if (isErrorRecord(err) && err.name === 'ValidationError') {
        statusCode = 400;
        const validationErrors = isErrorRecord(err.errors) ? Object.values(err.errors) : [];
        message = validationErrors
            .map(getValidationMessage)
            .filter((item): item is string => Boolean(item))
            .join(', ');
        if (!message) message = 'Dữ liệu không hợp lệ.';
    } else if (isErrorRecord(err) && err.code === 11000) {
        statusCode = 409;
        const field = isErrorRecord(err.keyValue) ? Object.keys(err.keyValue)[0] : undefined;
        message = `Dữ liệu bị trùng lặp: ${field || 'trường dữ liệu này'} đã tồn tại.`;
    } else if (isErrorRecord(err) && err.name === 'CastError') {
        statusCode = 400;
        message = 'Giá trị định danh hoặc kiểu dữ liệu không hợp lệ.';
    } else if (err instanceof multer.MulterError) {
        statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        message =
            err.code === 'LIMIT_FILE_SIZE' ? 'Tệp tải lên vượt quá kích thước cho phép.' : 'Tệp tải lên không hợp lệ.';
    } else if (err instanceof SyntaxError && isErrorRecord(err) && 'body' in err) {
        statusCode = 400;
        message = 'Nội dung JSON không hợp lệ.';
    } else {
        logger.error('Unrecognized Error:', err);
    }

    res.status(statusCode).json({
        success: false,
        status: statusCode,
        message,
    });
};
