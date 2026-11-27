import 'dotenv/config';
import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
    JWT_EXPIRES_IN: z.string().default('1h'),
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
    CORS_ORIGIN: z.string().default('*'),
    RATE_LIMIT_ENABLED: booleanFromString.default(true),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    SEED_ADMIN_EMAIL: z.string().email().default('admin@easylook.dev'),
    SEED_ADMIN_PASSWORD: z.string().min(8).default('Admin12345!'),
    SEED_DEMO_EMAIL: z.string().email().default('demo@easylook.dev'),
    SEED_DEMO_PASSWORD: z.string().min(8).default('Demo12345!'),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production' && value.JWT_SECRET.includes('change-me')) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'Replace the example JWT_SECRET before running in production',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
  // The logger depends on this module, so configuration errors go straight to stderr.
  console.error(`Invalid environment configuration:\n${issues.join('\n')}`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
