import { and, asc, count, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../../db/client';
import { garments, stores, type StoreRow } from '../../db/schema';
import { AppError, ErrorCode, isUniqueViolation } from '../../lib/errors';
import { offsetOf, toPage, type Page } from '../../lib/pagination';
import type { CreateStoreBody, StoreListQuery, StoreResponse, UpdateStoreBody } from './catalog.schemas';

const activeGarmentCount = sql<number>`(
  select count(*)::int from ${garments}
  where ${garments.storeId} = ${stores.id} and ${garments.active} = true
)`;

function toStoreResponse(row: StoreRow & { garmentCount: number }): StoreResponse {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    style: row.style,
    active: row.active,
    garmentCount: row.garmentCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function listStores(query: StoreListQuery, canSeeInactive: boolean): Promise<Page<StoreResponse>> {
  const filters: SQL[] = [];
  if (!(canSeeInactive && query.includeInactive)) filters.push(eq(stores.active, true));
  if (query.style) filters.push(eq(stores.style, query.style));
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    filters.push(or(ilike(stores.name, pattern), ilike(stores.description, pattern))!);
  }
  const where = and(...filters);

  const [rows, [totals]] = await Promise.all([
    db
      .select({ store: stores, garmentCount: activeGarmentCount })
      .from(stores)
      .where(where)
      .orderBy(asc(stores.name))
      .limit(query.limit)
      .offset(offsetOf(query)),
    db.select({ total: count() }).from(stores).where(where),
  ]);

  return toPage(
    rows.map((row) => toStoreResponse({ ...row.store, garmentCount: row.garmentCount })),
    totals?.total ?? 0,
    query,
  );
}

export async function getStore(id: string, canSeeInactive: boolean): Promise<StoreResponse> {
  const [row] = await db
    .select({ store: stores, garmentCount: activeGarmentCount })
    .from(stores)
    .where(eq(stores.id, id))
    .limit(1);
  if (!row || (!row.store.active && !canSeeInactive)) throw AppError.notFound('Tienda');
  return toStoreResponse({ ...row.store, garmentCount: row.garmentCount });
}

function rethrowDuplicateName(error: unknown, name: string | undefined): never {
  if (isUniqueViolation(error)) {
    throw new AppError(409, ErrorCode.CONFLICT, `Ya existe una tienda llamada "${name}".`);
  }
  throw error;
}

export async function createStore(input: CreateStoreBody): Promise<StoreResponse> {
  try {
    const [row] = await db.insert(stores).values(input).returning();
    return toStoreResponse({ ...row!, garmentCount: 0 });
  } catch (error) {
    rethrowDuplicateName(error, input.name);
  }
}

export async function updateStore(id: string, input: UpdateStoreBody): Promise<StoreResponse> {
  try {
    const [row] = await db.update(stores).set(input).where(eq(stores.id, id)).returning();
    if (!row) throw AppError.notFound('Tienda');
  } catch (error) {
    rethrowDuplicateName(error, input.name);
  }
  return getStore(id, true);
}
