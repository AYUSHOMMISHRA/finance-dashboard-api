// src/utils/AppError.ts
export class AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  static notFound(resource = 'Resource'): AppError {
    return new AppError(`${resource} not found`, 404, 'NOT_FOUND');
  }

  static forbidden(msg = 'Access denied'): AppError {
    return new AppError(msg, 403, 'FORBIDDEN');
  }

  static unauthorized(msg = 'Authentication required'): AppError {
    return new AppError(msg, 401, 'UNAUTHORIZED');
  }
}
