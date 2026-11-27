import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, ErrorCode, errorBody, isUniqueViolation } from '../lib/errors';
import { logger } from '../lib/logger';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(errorBody(ErrorCode.NOT_FOUND, `La ruta ${req.method} ${req.path} no existe.`));
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof AppError) {
    res.status(error.status).json(errorBody(error.code, error.message, error.details));
    return;
  }

  if (error instanceof ZodError) {
    const issues = error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
    res.status(400).json(errorBody(ErrorCode.VALIDATION_ERROR, 'La solicitud tiene datos inválidos.', { issues }));
    return;
  }

  const bodyParserType = (error as { type?: string })?.type;
  if (bodyParserType === 'entity.parse.failed') {
    res.status(400).json(errorBody(ErrorCode.INVALID_JSON, 'El cuerpo de la solicitud no es JSON válido.'));
    return;
  }
  if (bodyParserType === 'entity.too.large') {
    res.status(413).json(errorBody(ErrorCode.VALIDATION_ERROR, 'El cuerpo de la solicitud es demasiado grande.'));
    return;
  }

  if (isUniqueViolation(error)) {
    res.status(409).json(errorBody(ErrorCode.CONFLICT, 'El recurso ya existe.'));
    return;
  }

  logger.error({ err: error, method: req.method, path: req.path }, 'Unhandled error');
  res.status(500).json(errorBody(ErrorCode.INTERNAL_ERROR, 'Ocurrió un error inesperado en el servidor.'));
}
