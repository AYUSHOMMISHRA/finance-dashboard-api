// src/middlewares/authorize.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Role } from '@prisma/client';
import { AppError } from '../utils/AppError';

export const authorize = (...roles: Role[]): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }

    if (!roles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          `Access denied. Required: [${roles.join(', ')}]. ` +
            `Your role: ${req.user.role}`
        )
      );
    }

    next();
  };
};
