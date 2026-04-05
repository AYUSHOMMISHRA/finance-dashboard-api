// src/middlewares/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { sendError } from '../utils/response';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // 1. ZodError → 400 VALIDATION_ERROR
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, 'Validation failed', 400, 'VALIDATION_ERROR', details);
    return;
  }

  // 2. SyntaxError with 'body' property (malformed JSON)
  if (err instanceof SyntaxError && 'body' in err) {
    sendError(res, 'Invalid JSON in request body', 400, 'MALFORMED_JSON');
    return;
  }

  // 3. PayloadTooLargeError
  if ((err as Error & { type?: string }).type === 'entity.too.large') {
    sendError(res, 'Request body too large (max 10kb)', 413, 'PAYLOAD_TOO_LARGE');
    return;
  }

  // 4. AppError (isOperational)
  if (err instanceof AppError && err.isOperational) {
    sendError(res, err.message, err.statusCode, err.code);
    return;
  }

  // 5. Prisma P2002 → 409 DUPLICATE_ENTRY
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    sendError(res, 'Resource already exists', 409, 'DUPLICATE_ENTRY');
    return;
  }

  // 6. Prisma P2025 → 404 NOT_FOUND
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    sendError(res, 'Resource not found', 404, 'NOT_FOUND');
    return;
  }

  // 7. Prisma P2003 → 400 INVALID_REFERENCE
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
    sendError(res, 'Invalid reference', 400, 'INVALID_REFERENCE');
    return;
  }

  // 8. JsonWebTokenError → 401 INVALID_TOKEN
  if (err instanceof JsonWebTokenError) {
    sendError(res, 'Invalid token', 401, 'INVALID_TOKEN');
    return;
  }

  // TokenExpiredError → 401 TOKEN_EXPIRED
  if (err instanceof TokenExpiredError) {
    sendError(res, 'Token expired', 401, 'TOKEN_EXPIRED');
    return;
  }

  // 9. All others in production → 500 INTERNAL_ERROR
  // Never include err.message or stack in production response.
  console.error('[UNEXPECTED ERROR]', err);

  if (process.env.NODE_ENV === 'production') {
    sendError(res, 'Internal server error', 500, 'INTERNAL_ERROR');
  } else {
    // In development include err.stack for debugging.
    sendError(
      res,
      err.message || 'Internal server error',
      500,
      'INTERNAL_ERROR',
      { stack: err.stack }
    );
  }
};
