import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
import { db, type Executor } from '../../db/client';
import { garmentOccasions, garments, occasions, stores, type GarmentRow } from '../../db/schema';
import { AppError, ErrorCode } from '../../lib/errors';
import { CURRENCY } from '../../lib/money';
import { offsetOf, toPage, type Page } from '../../lib/pagination';
import type { CreateGarmentBody, GarmentListQuery, GarmentResponse, UpdateGarmentBody } from './catalog.schemas';
import { resolveOccasionIds } from './occasions.service';
import { escapeLike } from './stores.service';

const garmentSelection = {
  garment: garments,
  store: { id: stores.id, name: stores.name, style: stores.style, active: stores.active },
};

type GarmentStoreView = { id: string; name: string; style: string; active: boolean };

function toGarmentResponse(row: GarmentRow, store: GarmentStoreView, occasionCodes: string[]): GarmentResponse {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    priceCop: row.priceCop,
    currency: CURRENCY,
    style: row.style,
    color: row.color,
    sizes: row.sizes,
    occasions: occasionCodes,
    active: row.active,
    store,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function occasionCodesByGarment(ids: string[], executor: Executor): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (ids.length === 0) return result;
  const rows = await executor
    .select({ garmentId: garmentOccasions.garmentId, code: occasions.code })
    .from(garmentOccasions)
    .innerJoin(occasions, eq(occasions.id, garmentOccasions.occasionId))
    .where(inArray(garmentOccasions.garmentId, ids))
    .orderBy(asc(occasions.code));
  for (const row of rows) {
    result.set(row.garmentId, [...(result.get(row.garmentId) ?? []), row.code]);
  }
  return result;
}

async function hydrate(
  rows: { garment: GarmentRow; store: GarmentStoreView }[],
  executor: Executor,
): Promise<GarmentResponse[]> {
  const codes = await occasionCodesByGarment(
    rows.map((row) => row.garment.id),
    executor,
  );
  return rows.map((row) => toGarmentResponse(row.garment, row.store, codes.get(row.garment.id) ?? []));
}

/** Loads full garment views (store and occasions included) keyed by id, regardless of their active flag. */
export async function loadGarments(ids: string[], executor: Executor = db): Promise<Map<string, GarmentResponse>> {
  if (ids.length === 0) return new Map();
  const rows = await executor
    .select(garmentSelection)
    .from(garments)
    .innerJoin(stores, eq(stores.id, garments.storeId))
    .where(inArray(garments.id, ids));
  const views = await hydrate(rows, executor);
  return new Map(views.map((view) => [view.id, view]));
}

export function occasionFilter(code: string): SQL {
  return sql`exists (
    select 1 from ${garmentOccasions}
    inner join ${occasions} on ${occasions.id} = ${garmentOccasions.occasionId}
    where ${garmentOccasions.garmentId} = ${garments.id} and ${occasions.code} = ${code}
  )`;
}

export function sizeFilter(size: string): SQL {
  return sql`${size} = any(${garments.sizes})`;
}

export const availableGarmentFilter = and(eq(garments.active, true), eq(stores.active, true))!;

const sortOrder = {
  price_asc: [asc(garments.priceCop), asc(garments.name)],
  price_desc: [desc(garments.priceCop), asc(garments.name)],
  name: [asc(garments.name), asc(garments.id)],
  newest: [desc(garments.createdAt), asc(garments.id)],
} as const;

export async function listGarments(query: GarmentListQuery, canSeeInactive: boolean): Promise<Page<GarmentResponse>> {
  const filters: SQL[] = [];
  if (!(canSeeInactive && query.includeInactive)) filters.push(availableGarmentFilter);
  if (query.storeId) filters.push(eq(garments.storeId, query.storeId));
  if (query.category) filters.push(eq(garments.category, query.category));
  if (query.style) filters.push(eq(garments.style, query.style));
  if (query.color) filters.push(eq(garments.color, query.color));
  if (query.size) filters.push(sizeFilter(query.size));
  if (query.occasion) filters.push(occasionFilter(query.occasion));
  if (query.minPriceCop !== undefined) filters.push(gte(garments.priceCop, query.minPriceCop));
  if (query.maxPriceCop !== undefined) filters.push(lte(garments.priceCop, query.maxPriceCop));
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    filters.push(or(ilike(garments.name, pattern), ilike(garments.description, pattern))!);
  }
  const where = and(...filters);

  const [rows, [totals]] = await Promise.all([
    db
      .select(garmentSelection)
      .from(garments)
      .innerJoin(stores, eq(stores.id, garments.storeId))
      .where(where)
      .orderBy(...sortOrder[query.sort])
      .limit(query.limit)
      .offset(offsetOf(query)),
    db.select({ total: count() }).from(garments).innerJoin(stores, eq(stores.id, garments.storeId)).where(where),
  ]);

  return toPage(await hydrate(rows, db), totals?.total ?? 0, query);
}

export async function getGarment(id: string, canSeeInactive: boolean): Promise<GarmentResponse> {
  const garment = (await loadGarments([id])).get(id);
  if (!garment || (!canSeeInactive && (!garment.active || !garment.store.active))) {
    throw AppError.notFound('Prenda');
  }
  return garment;
}

async function requireStoreForGarment(storeId: string, executor: Executor): Promise<void> {
  const [store] = await executor
    .select({ active: stores.active })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);
  if (!store) throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'La tienda indicada no existe.', { storeId });
  if (!store.active) {
    throw new AppError(400, ErrorCode.STORE_INACTIVE, 'La tienda está desactivada y no admite prendas nuevas.');
  }
}

async function replaceOccasions(garmentId: string, codes: string[], executor: Executor): Promise<void> {
  const occasionIds = await resolveOccasionIds(codes, executor);
  await executor.delete(garmentOccasions).where(eq(garmentOccasions.garmentId, garmentId));
  await executor.insert(garmentOccasions).values(occasionIds.map((occasionId) => ({ garmentId, occasionId })));
}

export async function createGarment(input: CreateGarmentBody): Promise<GarmentResponse> {
  const { occasionCodes, ...values } = input;
  const id = await db.transaction(async (tx) => {
    await requireStoreForGarment(values.storeId, tx);
    const [row] = await tx
      .insert(garments)
      .values({ ...values, sizes: [...new Set(values.sizes)] })
      .returning({ id: garments.id });
    await replaceOccasions(row!.id, occasionCodes, tx);
    return row!.id;
  });
  return getGarment(id, true);
}

export async function updateGarment(id: string, input: UpdateGarmentBody): Promise<GarmentResponse> {
  const { occasionCodes, ...values } = input;
  await db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: garments.id }).from(garments).where(eq(garments.id, id)).limit(1);
    if (!existing) throw AppError.notFound('Prenda');
    if (values.storeId) await requireStoreForGarment(values.storeId, tx);
    if (Object.keys(values).length > 0) {
      await tx
        .update(garments)
        .set({ ...values, ...(values.sizes && { sizes: [...new Set(values.sizes)] }) })
        .where(eq(garments.id, id));
    }
    if (occasionCodes) await replaceOccasions(id, occasionCodes, tx);
  });
  return getGarment(id, true);
}

/** Garments are never hard-deleted: saved outfits keep referencing them. */
export async function deactivateGarment(id: string): Promise<void> {
  const [row] = await db
    .update(garments)
    .set({ active: false })
    .where(eq(garments.id, id))
    .returning({ id: garments.id });
  if (!row) throw AppError.notFound('Prenda');
}
