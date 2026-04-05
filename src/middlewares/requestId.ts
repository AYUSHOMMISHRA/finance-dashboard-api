// src/middlewares/requestId.ts
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const requestId = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  const id = uuidv4();
  res.locals.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
};
