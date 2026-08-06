import { Router } from 'express';
import { register, requestOTP, verifyOTP, login, refreshToken, logout, getMe, googleLogin, completeProfile } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authRateLimiter, otpRateLimiter } from '../middlewares/rateLimiter.js';
import { registerSchema, loginSchema, otpRequestSchema, otpVerifySchema } from '../validators/auth.validator.js';

const router = Router();

router.post('/register', authRateLimiter, validate(registerSchema), register);
router.post('/otp/request', otpRateLimiter, validate(otpRequestSchema), requestOTP);
router.post('/otp/verify', authRateLimiter, validate(otpVerifySchema), verifyOTP);
router.post('/login', authRateLimiter, validate(loginSchema), login);
router.post('/google', authRateLimiter, googleLogin);
router.post('/complete-profile', authMiddleware, completeProfile);
router.post('/refresh', refreshToken);
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, getMe);

export default router;
