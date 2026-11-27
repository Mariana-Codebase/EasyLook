import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { closeDatabase, db } from './client';

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
}

if (require.main === module) {
  runMigrations()
    .then(() => console.log('Migrations applied'))
    .catch((error: unknown) => {
      console.error('Migration failed', error);
      process.exitCode = 1;
    })
    .finally(() => closeDatabase());
}
