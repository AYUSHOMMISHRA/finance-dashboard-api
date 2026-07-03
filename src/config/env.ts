// src/config/env.ts
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

console.log('[ENV_DEBUG] DATABASE_URL value:', process.env.DATABASE_URL);

const result = schema.safeParse(process.env);

if (!result.success) {
  console.log('[ENV_DEBUG] All env vars:', Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('POSTGRES')));
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
