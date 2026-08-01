import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import apiRouter from '@common/routes/index';
import { errorHandler } from '@common/middlewares/error.middleware';
import { trimRequest } from '@common/middlewares/trim.middleware';
import mongoose from 'mongoose';
import { COOKIE_SECRET, CORS_ORIGINS, NODE_ENV, TRUST_PROXY } from '@config/environment';
import { ApiError } from '@common/utils/ApiError';

const app: Application = express();

if (TRUST_PROXY !== false) app.set('trust proxy', TRUST_PROXY);
app.disable('x-powered-by');

const developmentOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
];
const allowedOrigins = new Set(
    CORS_ORIGINS.length > 0 ? CORS_ORIGINS : NODE_ENV === 'development' ? developmentOrigins : [],
);

app.use(
    cors({
        origin(origin, callback) {
            if (!origin || allowedOrigins.has(origin)) return callback(null, true);
            return callback(new ApiError(403, 'Origin không được phép truy cập API.'));
        },
        credentials: true,
    }),
);
app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser(COOKIE_SECRET || undefined));
app.use(trimRequest);

app.get('/live', (_req, res) => {
    res.status(200).json({ status: 'OK', message: 'AnanLeather Works API is running' });
});

// Readiness: giữ nguyên contract thành công cũ, nhưng trả 503 khi DB chưa sẵn sàng.
app.get('/health', (_req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({
        status: ready ? 'OK' : 'NOT_READY',
        message: ready ? 'AnanLeather Works API is running' : 'Database is not ready',
    });
});

// API Central Router
app.use('/api', apiRouter);

app.use((_req, _res, next) => next(new ApiError(404, 'Không tìm thấy API được yêu cầu.')));

// Centralized Error Handler
app.use(errorHandler);

export default app;
