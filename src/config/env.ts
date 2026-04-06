// src/config/env.ts
console.log('[STARTUP] env.ts loading at', new Date().toISOString());
import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

const result = schema.safeParse(process.env);

console.log('[STARTUP] env validation result:', result.success ? 'SUCCESS' : 'FAILED');
if (!result.success) {
  console.log('[STARTUP] Validation errors:', JSON.stringify(result.error.flatten().fieldErrors, null, 2));
  console.error('[ENV] Invalid environment variables:');
  console.error(result.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = result.data;

if (env.JWT_SECRET.length < 32) {
  console.warn(
    '[SECURITY] JWT_SECRET shorter than 32 chars. ' +
      'Use a longer random string in production.'
  );
}
console.log('[STARTUP] env.ts completed successfully');
