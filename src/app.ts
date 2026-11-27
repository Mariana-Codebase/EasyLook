import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { buildOpenApiDocument } from './docs/openapi';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { authRouter } from './modules/auth/auth.routes';
import { garmentsRouter, occasionsRouter, storesRouter } from './modules/catalog/catalog.routes';
import { recommendationsRouter } from './modules/look-match/look-match.routes';
import { outfitsRouter } from './modules/outfits/outfit.routes';

export function createApp() {
  const app = express();
  const openApiDocument = buildOpenApiDocument();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(pinoHttp({ logger, autoLogging: env.NODE_ENV !== 'test' }));
  app.use(cors({ origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(',') }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });
  // Swagger UI needs inline scripts, so its route gets a relaxed CSP and the API keeps helmet's defaults.
  app.use('/docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get('/', (_req, res) => {
    res.redirect('/docs');
  });

  const api = Router();
  api.use(helmet());
  api.use('/auth', authRouter);
  api.use('/stores', storesRouter);
  api.use('/occasions', occasionsRouter);
  api.use('/garments', garmentsRouter);
  api.use('/outfits', outfitsRouter);
  api.use('/recommendations', recommendationsRouter);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
