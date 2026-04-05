// src/app.ts
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { swaggerSpec } from './config/swagger';
import { requestId } from './middlewares/requestId';
import { errorHandler } from './middlewares/errorHandler';
import { AppError } from './utils/AppError';
import { authRouter } from './modules/auth/auth.routes';
import { userRouter } from './modules/users/user.routes';
import { recordRouter } from './modules/records/record.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export const app = express();

// 1. requestId middleware (absolutely first)
app.use(requestId);

// 2. trust proxy — MUST be before rate limiters
app.set('trust proxy', 1);
// In Docker/nginx, all traffic arrives from the proxy IP.
// Without this, everyone shares one rate limit bucket.
// With it, Express reads real client IP from X-Forwarded-For.

// 3. Helmet with Swagger UI exemption
app.use((req: Request, res: Response, next: NextFunction): void => {
  if (req.originalUrl.includes('/api/v1/docs')) return next();
  // Use originalUrl not req.path — works regardless of mount point.
  // Helmet's strict CSP blocks Swagger UI inline scripts silently.
  helmet()(req, res, next);
});

// 4. CORS
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// 5. Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 6. Health check — MUST be registered BEFORE rate limiters
app.get('/health', (_req: Request, res: Response): void => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
  });
});

// 7. Morgan logging
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
if (env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
}
// test: morgan skipped — keeps test output clean
// dev: human-readable colored output
// combined: Apache format for production log aggregators

// 8. Global rate limiter
app.use(
  rateLimit({
    windowMs: FIFTEEN_MINUTES,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    // skip in test env — prevents random 429s in test suite
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Try again later.',
      },
    },
  })
);

// 9. Auth rate limiter (stricter) applied to authRouter
const authRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 10,
  skip: () => env.NODE_ENV === 'test',
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many auth attempts. Try again later.',
    },
  },
});

// 10. Swagger UI
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 11. Mount routers
app.use('/api/v1/auth', authRateLimiter, authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/records', recordRouter);
app.use('/api/v1/dashboard', dashboardRouter);

// 12. 404 handler
app.use((_req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError('Route not found', 404, 'NOT_FOUND'));
});

// 13. Error handler (last, exactly 4 params)
app.use(errorHandler);
