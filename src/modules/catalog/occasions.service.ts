import { asc, eq, inArray } from 'drizzle-orm';
import { db, type Executor } from '../../db/client';
import { occasions, type OccasionRow } from '../../db/schema';
import { AppError, ErrorCode, isUniqueViolation } from '../../lib/errors';
import type { CreateOccasionBody, OccasionResponse, UpdateOccasionBody } from './catalog.schemas';

export function toOccasionResponse(row: OccasionRow): OccasionResponse {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    recommendedStyles: row.recommendedStyles,
    active: row.active,
  };
}

export async function listOccasions(includeInactive: boolean): Promise<OccasionResponse[]> {
  const rows = await db
    .select()
    .from(occasions)
    .where(includeInactive ? undefined : eq(occasions.active, true))
    .orderBy(asc(occasions.name));
  return rows.map(toOccasionResponse);
}

/** Resolves an occasion that new outfits or recommendations may use. */
export async function requireActiveOccasion(code: string, executor: Executor = db): Promise<OccasionRow> {
  const [row] = await executor.select().from(occasions).where(eq(occasions.code, code)).limit(1);
  if (!row) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, `La ocasión "${code}" no existe.`, {
      occasionCode: code,
    });
  }
  if (!row.active) {
    throw new AppError(400, ErrorCode.OCCASION_INACTIVE, `La ocasión "${code}" no está disponible.`);
  }
  return row;
}

export async function resolveOccasionIds(codes: string[], executor: Executor = db): Promise<string[]> {
  const unique = [...new Set(codes)];
  const rows = await executor
    .select({ id: occasions.id, code: occasions.code })
    .from(occasions)
    .where(inArray(occasions.code, unique));
  const missing = unique.filter((code) => !rows.some((row) => row.code === code));
  if (missing.length > 0) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Algunas ocasiones no existen.', { missing });
  }
  return rows.map((row) => row.id);
}

export async function createOccasion(input: CreateOccasionBody): Promise<OccasionResponse> {
  try {
    const [row] = await db
      .insert(occasions)
      .values({ ...input, recommendedStyles: [...new Set(input.recommendedStyles)] })
      .returning();
    return toOccasionResponse(row!);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, ErrorCode.CONFLICT, `Ya existe una ocasión con el código "${input.code}".`);
    }
    throw error;
  }
}

export async function updateOccasion(id: string, input: UpdateOccasionBody): Promise<OccasionResponse> {
  const [row] = await db
    .update(occasions)
    .set({
      ...input,
      ...(input.recommendedStyles !== undefined && { recommendedStyles: [...new Set(input.recommendedStyles)] }),
    })
    .where(eq(occasions.id, id))
    .returning();
  if (!row) throw AppError.notFound('Ocasión');
  return toOccasionResponse(row);
}
