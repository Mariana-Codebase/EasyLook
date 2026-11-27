import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { env } from '../../config/env';
import { db } from '../../db/client';
import { users, type UserRow } from '../../db/schema';
import { AppError, ErrorCode, isUniqueViolation } from '../../lib/errors';
import { signToken } from '../../middleware/auth';
import type { LoginBody, RegisterBody, UpdateMeBody, UserResponse } from './auth.schemas';

// Compared against when the email does not exist, so both failure paths take the same time.
const DUMMY_HASH = bcrypt.hashSync('easylook-timing-guard', env.BCRYPT_ROUNDS);

export function toUserResponse(user: UserRow): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    preferredStyles: user.preferredStyles,
    preferredSizes: user.preferredSizes,
    createdAt: user.createdAt.toISOString(),
  };
}

function authResponse(user: UserRow) {
  return {
    token: signToken(user),
    tokenType: 'Bearer' as const,
    expiresIn: env.JWT_EXPIRES_IN,
    user: toUserResponse(user),
  };
}

export async function register(input: RegisterBody) {
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  try {
    const [user] = await db
      .insert(users)
      .values({ name: input.name, email: input.email, passwordHash, role: 'user' })
      .returning();
    return authResponse(user!);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, ErrorCode.EMAIL_ALREADY_REGISTERED, 'Ya existe una cuenta con ese correo.');
    }
    throw error;
  }
}

export async function login(input: LoginBody) {
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  const matches = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !matches) {
    throw new AppError(401, ErrorCode.INVALID_CREDENTIALS, 'Correo o contraseña incorrectos.');
  }
  return authResponse(user);
}

export async function getUserById(id: string): Promise<UserRow> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) throw AppError.unauthorized();
  return user;
}

export async function updateMe(id: string, input: UpdateMeBody) {
  const [user] = await db
    .update(users)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.preferredStyles !== undefined && { preferredStyles: [...new Set(input.preferredStyles)] }),
      ...(input.preferredSizes !== undefined && { preferredSizes: [...new Set(input.preferredSizes)] }),
    })
    .where(eq(users.id, id))
    .returning();
  if (!user) throw AppError.unauthorized();
  return toUserResponse(user);
}
