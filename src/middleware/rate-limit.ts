import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env';
import { ErrorCode, errorBody } from '../lib/errors';

function limiter(windowMinutes: number, limit: number): RequestHandler {
  if (!env.RATE_LIMIT_ENABLED) return (_req, _res, next) => next();
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res
        .status(429)
        .json(errorBody(ErrorCode.RATE_LIMITED, 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.'));
    },
  });
}

/** Slows down credential stuffing on register and login. */
export const authRateLimit = limiter(15, 20);

/** Look Match evaluates thousands of combinations per call, so it gets its own budget. */
export const recommendationRateLimit = limiter(1, 30);
