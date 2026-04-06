// src/index.ts
// Line 1 — MUST be first import, validates env before anything loads
import './config/env';
import { env } from './config/env';
import { app } from './app';
import { prisma } from './utils/prismaClient';

// Register BEFORE server.listen
process.on('unhandledRejection', (reason): void => {
  console.error('[UnhandledRejection]', reason);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err): void => {
  console.error('[UncaughtException]', err);
  server.close(() => process.exit(1));
});

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.info(`Server:  http://localhost:${env.PORT}`);
  console.info(`Docs:    http://localhost:${env.PORT}/api/v1/docs`);
  console.info(`Health:  http://localhost:${env.PORT}/health`);
  console.info(`Env:     ${env.NODE_ENV}`);
});

const shutdown = async (): Promise<void> => {
  server.close(async () => {
    await prisma.$disconnect();
    console.info('Shutdown complete.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
