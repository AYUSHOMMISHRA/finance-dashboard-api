// src/utils/response.ts
import { Response } from 'express';
import { Prisma } from '@prisma/client';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: PaginationMeta
): void => {
  const response: { success: true; data: T; meta?: PaginationMeta } = {
    success: true,
    data,
  };
  if (meta) {
    response.meta = meta;
  }
  res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  message: string,
  statusCode: number,
  code?: string,
  details?: unknown
): void => {
  const errorResponse: {
    success: false;
    requestId: string;
    error: { code: string; message: string; details?: unknown };
  } = {
    success: false,
    requestId: res.locals.requestId,
    error: {
      code: code || 'INTERNAL_ERROR',
      message,
    },
  };
  if (details) {
    errorResponse.error.details = details;
  }
  res.status(statusCode).json(errorResponse);
};

export const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  // password intentionally omitted everywhere
} satisfies Prisma.UserSelect;

export type SafeUser = Prisma.UserGetPayload<{
  select: typeof safeUserSelect;
}>;
