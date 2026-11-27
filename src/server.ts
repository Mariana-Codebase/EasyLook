import { createApp } from './app';
import { env } from './config/env';
import { closeDatabase } from './db/client';
import { logger } from './lib/logger';

const server = createApp().listen(env.PORT, () => {
  logger.info(`EasyLook API listening on http://localhost:${env.PORT} (docs at /docs)`);
});

function shutdown(signal: string): void {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    closeDatabase()
      .catch((error: unknown) => logger.error({ err: error }, 'Error closing the database pool'))
      .finally(() => process.exit(0));
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
