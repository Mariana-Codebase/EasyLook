import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

/** Applies migrations to the test database once per run. */
export default async function globalSetup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/easylook_test';
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  } finally {
    await pool.end();
  }
}
