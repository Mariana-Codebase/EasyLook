import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { env } from '../config/env';
import { db } from '../db/client';
import { users, type UserRole } from '../db/schema';
import { AppError } from '../lib/errors';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

interface TokenPayload {
  sub: string;
  role: UserRole;
}

export function signToken(user: Pick<AuthUser, 'id' | 'role'>): string {
  return jwt.sign({ role: user.role } satisfies Omit<TokenPayload, 'sub'>, env.JWT_SECRET, {
    subject: user.id,
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

function readBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) throw AppError.unauthorized();
  return token;
}

async function resolveUser(token: string): Promise<AuthUser> {
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
  } catch {
    throw AppError.unauthorized();
  }
  // The role is always read from the database so a demoted or deleted account loses access immediately.
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1);
  if (!user) throw AppError.unauthorized();
  return user;
}

/** Requires a valid bearer token. */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = readBearerToken(req);
  if (!token) throw AppError.unauthorized();
  req.user = await resolveUser(token);
  next();
}

/** Attaches the user when a token is present; visitors continue anonymously. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = readBearerToken(req);
  if (token) req.user = await resolveUser(token);
  next();
}

export function requireRole(role: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw AppError.unauthorized();
    if (req.user.role !== role) throw AppError.forbidden();
    next();
  };
}

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export function isAdmin(req: Request): boolean {
  return req.user?.role === 'admin';
}
