// src/middlewares/authenticate.ts
import { Request, Response, NextFunction } from 'express';
import jwt, { TokenExpiredError } from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../utils/prismaClient';
import { AppError } from '../utils/AppError';
import { safeUserSelect } from '../utils/response';

interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  // Step 1 — extract token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Authentication token required'));
  }

  const token = authHeader.split(' ')[1];
  // Edge case: "Authorization: Bearer " with nothing after space.
  // split returns '' (empty string, falsy) — check explicitly.
  if (!token || token.trim() === '') {
    return next(AppError.unauthorized('Authentication token required'));
  }

  // Step 2 — verify and DB check
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // Fetch from DB every request — catches deactivated users
    // even when they still hold a valid JWT token
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: safeUserSelect,
      // safeUserSelect already includes status:true
      // no need to spread and re-add it
    });

    if (!user) {
      return next(AppError.unauthorized('User account no longer exists'));
    }

    if (user.status === 'INACTIVE') {
      return next(
        AppError.forbidden('Account deactivated. Contact an administrator.')
      );
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      return next(new AppError('Token expired', 401, 'TOKEN_EXPIRED'));
    }
    return next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
  }
};
