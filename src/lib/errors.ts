export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_JSON: 'INVALID_JSON',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  FORBIDDEN: 'FORBIDDEN',
  FORBIDDEN_RESOURCE: 'FORBIDDEN_RESOURCE',
  NOT_FOUND: 'NOT_FOUND',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  CONFLICT: 'CONFLICT',
  GARMENT_ALREADY_ADDED: 'GARMENT_ALREADY_ADDED',
  GARMENT_NOT_IN_OUTFIT: 'GARMENT_NOT_IN_OUTFIT',
  GARMENT_INACTIVE: 'GARMENT_INACTIVE',
  STORE_INACTIVE: 'STORE_INACTIVE',
  OCCASION_INACTIVE: 'OCCASION_INACTIVE',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  OUTFIT_INCOMPLETE: 'OUTFIT_INCOMPLETE',
  NO_MATCH_FOUND: 'NO_MATCH_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static notFound(resource: string): AppError {
    return new AppError(404, ErrorCode.NOT_FOUND, `${resource} no encontrado.`);
  }

  static unauthorized(message = 'Falta autenticación o el token no es válido.'): AppError {
    return new AppError(401, ErrorCode.UNAUTHORIZED, message);
  }

  static forbidden(message = 'Tu rol no permite realizar esta acción.'): AppError {
    return new AppError(403, ErrorCode.FORBIDDEN, message);
  }
}

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function errorBody(code: string, message: string, details?: Record<string, unknown>): ErrorBody {
  return details === undefined ? { error: { code, message } } : { error: { code, message, details } };
}

/** PostgreSQL SQLSTATE for unique_violation. */
export const PG_UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: unknown): boolean {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  return typeof cause === 'object' && cause !== null && (cause as { code?: string }).code === PG_UNIQUE_VIOLATION;
}
