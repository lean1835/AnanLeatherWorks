import { Router } from 'express';
import { login, logout, getMe, register } from './auth.controller';
import { authenticate } from '@common/middlewares/auth.middleware';
import { loginRateLimiter } from '@common/middlewares/rateLimiter.middleware';
import { validate } from '@common/middlewares/validate.middleware';
import { loginSchema, registerSchema } from './auth.validation';
import { requireBootstrapToken } from '@common/middlewares/bootstrap.middleware';

const router = Router();

router.post('/register', loginRateLimiter, requireBootstrapToken, validate(registerSchema), register);
router.post('/login', loginRateLimiter, validate(loginSchema), login);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);

export default router;
