import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { sseManager } from '../sse/sseManager.js';

export const sseHandler = (req: AuthRequest, res: Response, _next: NextFunction) => {
  const { userId, role } = req.user!;
  sseManager.addClient(userId, role, res);
};
