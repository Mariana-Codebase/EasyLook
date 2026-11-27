// Runs before every test file and before `src/config/env.ts` is loaded.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/easylook_test';
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256-signing';
process.env.BCRYPT_ROUNDS = '4';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.LOG_LEVEL = 'silent';
