import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware.js';
import { AppError } from './error.middleware.js';
import { Role } from '../config/constants.js';

export const rbac =
  (...allowedRoles: Role[]) =>
  (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role as Role)) {
      return next(new AppError('Forbidden: insufficient permissions', 403));
    }
    next();
  };
