import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { sseHandler } from '../controllers/sse.controller.js';

const router = Router();

router.get('/notifications', authMiddleware, sseHandler);

export default router;
