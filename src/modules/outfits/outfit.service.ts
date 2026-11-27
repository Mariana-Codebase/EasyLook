import { and, asc, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { db, type Executor } from '../../db/client';
import { garments, occasions, outfitItems, outfits, type OutfitRow } from '../../db/schema';
import { AppError, ErrorCode, isUniqueViolation } from '../../lib/errors';
import { CURRENCY } from '../../lib/money';
import { offsetOf, toPage, type Page } from '../../lib/pagination';
import type { GarmentResponse } from '../catalog/catalog.schemas';
import { loadGarments } from '../catalog/garments.service';
import { requireActiveOccasion } from '../catalog/occasions.service';
import { computeBudget, countStores, evaluateCompleteness, MAX_ITEMS_PER_OUTFIT } from './outfit.rules';
import type {
  ApplyRecommendationBody,
  CreateOutfitBody,
  OutfitItemResponse,
  OutfitItemsResult,
  OutfitListQuery,
  OutfitResponse,
  OutfitSummary,
  UpdateOutfitBody,
} from './outfit.schemas';

function toItem(garment: GarmentResponse): OutfitItemResponse {
  return {
    id: garment.id,
    name: garment.name,
    category: garment.category,
    priceCop: garment.priceCop,
    style: garment.style,
    color: garment.color,
    available: garment.active && garment.store.active,
    store: { id: garment.store.id, name: garment.store.name },
  };
}

/** Loads the outfit and enforces ownership (403 when it belongs to someone else). */
async function requireOwnedOutfit(
  userId: string,
  outfitId: string,
  executor: Executor = db,
  lock = false,
): Promise<OutfitRow> {
  const base = executor.select().from(outfits).where(eq(outfits.id, outfitId)).limit(1);
  const [outfit] = lock ? await base.for('update') : await base;
  if (!outfit) throw AppError.notFound('Outfit');
  if (outfit.userId !== userId) {
    throw new AppError(403, ErrorCode.FORBIDDEN_RESOURCE, 'Este outfit pertenece a otra persona.');
  }
  return outfit;
}

async function loadItems(outfitId: string, executor: Executor): Promise<OutfitItemResponse[]> {
  const rows = await executor
    .select({ garmentId: outfitItems.garmentId })
    .from(outfitItems)
    .where(eq(outfitItems.outfitId, outfitId))
    .orderBy(asc(outfitItems.addedAt), asc(outfitItems.garmentId));
  const garmentViews = await loadGarments(
    rows.map((row) => row.garmentId),
    executor,
  );
  return rows.flatMap((row) => {
    const garment = garmentViews.get(row.garmentId);
    return garment ? [toItem(garment)] : [];
  });
}

function summarizeItems(budgetCop: number | null, items: OutfitItemResponse[]) {
  const { isComplete, missingCategories } = evaluateCompleteness(items.map((item) => item.category));
  return {
    ...computeBudget(
      budgetCop,
      items.map((item) => item.priceCop),
    ),
    isComplete,
    missingCategories,
    storeCount: countStores(items.map((item) => item.store.id)),
  };
}

async function buildOutfit(outfitId: string, executor: Executor = db): Promise<OutfitResponse> {
  const [row] = await executor
    .select({ outfit: outfits, occasion: { code: occasions.code, name: occasions.name } })
    .from(outfits)
    .innerJoin(occasions, eq(occasions.id, outfits.occasionId))
    .where(eq(outfits.id, outfitId))
    .limit(1);
  if (!row) throw AppError.notFound('Outfit');
  const items = await loadItems(outfitId, executor);
  return {
    id: row.outfit.id,
    name: row.outfit.name,
    occasion: row.occasion,
    budgetCop: row.outfit.budgetCop,
    currency: CURRENCY,
    ...summarizeItems(row.outfit.budgetCop, items),
    status: row.outfit.status,
    itemCount: items.length,
    items,
    createdAt: row.outfit.createdAt.toISOString(),
    updatedAt: row.outfit.updatedAt.toISOString(),
    savedAt: row.outfit.savedAt?.toISOString() ?? null,
  };
}

function toItemsResult(outfit: OutfitResponse): OutfitItemsResult {
  return {
    outfitId: outfit.id,
    totalCop: outfit.totalCop,
    remainingCop: outfit.remainingCop,
    budgetStatus: outfit.budgetStatus,
    isComplete: outfit.isComplete,
    missingCategories: outfit.missingCategories,
    storeCount: outfit.storeCount,
    items: outfit.items,
  };
}

/** Any change to items, occasion or budget means a saved look has to be validated again. */
async function markAsDraft(outfitId: string, executor: Executor): Promise<void> {
  await executor
    .update(outfits)
    .set({ status: 'draft', savedAt: null, updatedAt: new Date() })
    .where(eq(outfits.id, outfitId));
}

export async function createOutfit(userId: string, input: CreateOutfitBody): Promise<OutfitResponse> {
  const occasion = await requireActiveOccasion(input.occasionCode);
  const [row] = await db
    .insert(outfits)
    .values({ userId, occasionId: occasion.id, name: input.name, budgetCop: input.budgetCop ?? null })
    .returning({ id: outfits.id });
  return buildOutfit(row!.id);
}

export async function listOutfits(userId: string, query: OutfitListQuery): Promise<Page<OutfitSummary>> {
  const filters: SQL[] = [eq(outfits.userId, userId)];
  if (query.status) filters.push(eq(outfits.status, query.status));
  if (query.occasion) filters.push(eq(occasions.code, query.occasion));
  const where = and(...filters);

  const totalCop = sql<number>`coalesce(sum(${garments.priceCop}), 0)::int`;
  const itemCount = sql<number>`count(${outfitItems.garmentId})::int`;

  const [rows, [totals]] = await Promise.all([
    db
      .select({ outfit: outfits, occasionCode: occasions.code, occasionName: occasions.name, totalCop, itemCount })
      .from(outfits)
      .innerJoin(occasions, eq(occasions.id, outfits.occasionId))
      .leftJoin(outfitItems, eq(outfitItems.outfitId, outfits.id))
      .leftJoin(garments, eq(garments.id, outfitItems.garmentId))
      .where(where)
      .groupBy(outfits.id, occasions.id)
      .orderBy(desc(outfits.updatedAt), asc(outfits.id))
      .limit(query.limit)
      .offset(offsetOf(query)),
    db
      .select({ total: count() })
      .from(outfits)
      .innerJoin(occasions, eq(occasions.id, outfits.occasionId))
      .where(where),
  ]);

  const data = rows.map((row): OutfitSummary => {
    const budget = computeBudget(row.outfit.budgetCop, [row.totalCop]);
    return {
      id: row.outfit.id,
      name: row.outfit.name,
      occasion: { code: row.occasionCode, name: row.occasionName },
      budgetCop: row.outfit.budgetCop,
      currency: CURRENCY,
      ...budget,
      status: row.outfit.status,
      itemCount: row.itemCount,
      createdAt: row.outfit.createdAt.toISOString(),
      updatedAt: row.outfit.updatedAt.toISOString(),
      savedAt: row.outfit.savedAt?.toISOString() ?? null,
    };
  });
  return toPage(data, totals?.total ?? 0, query);
}

export async function getOutfit(userId: string, outfitId: string): Promise<OutfitResponse> {
  await requireOwnedOutfit(userId, outfitId);
  return buildOutfit(outfitId);
}

export async function updateOutfit(userId: string, outfitId: string, input: UpdateOutfitBody): Promise<OutfitResponse> {
  return db.transaction(async (tx) => {
    const outfit = await requireOwnedOutfit(userId, outfitId, tx, true);
    const changes: Partial<typeof outfits.$inferInsert> = {};
    if (input.name !== undefined) changes.name = input.name;
    if (input.occasionCode !== undefined) changes.occasionId = (await requireActiveOccasion(input.occasionCode, tx)).id;
    if (input.budgetCop !== undefined) changes.budgetCop = input.budgetCop;

    const needsRevalidation =
      (changes.occasionId !== undefined && changes.occasionId !== outfit.occasionId) ||
      (changes.budgetCop !== undefined && changes.budgetCop !== outfit.budgetCop);
    if (needsRevalidation) Object.assign(changes, { status: 'draft', savedAt: null });

    await tx.update(outfits).set(changes).where(eq(outfits.id, outfitId));
    return buildOutfit(outfitId, tx);
  });
}

export async function deleteOutfit(userId: string, outfitId: string): Promise<void> {
  await requireOwnedOutfit(userId, outfitId);
  await db.delete(outfits).where(eq(outfits.id, outfitId));
}

/** Validates that every garment exists and can be added today (rule 6: active and from an active store). */
async function requireAvailableGarments(ids: string[], executor: Executor): Promise<Map<string, GarmentResponse>> {
  const found = await loadGarments(ids, executor);
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length > 0) {
    if (ids.length === 1) throw AppError.notFound('Prenda');
    throw new AppError(404, ErrorCode.NOT_FOUND, 'Algunas prendas no existen.', { missing });
  }
  for (const garment of found.values()) {
    if (!garment.store.active) {
      throw new AppError(400, ErrorCode.STORE_INACTIVE, `La tienda de "${garment.name}" está desactivada.`, {
        garmentId: garment.id,
        storeId: garment.store.id,
      });
    }
    if (!garment.active) {
      throw new AppError(400, ErrorCode.GARMENT_INACTIVE, `La prenda "${garment.name}" ya no está disponible.`, {
        garmentId: garment.id,
      });
    }
  }
  return found;
}

async function countItems(outfitId: string, executor: Executor): Promise<number> {
  const [row] = await executor.select({ total: count() }).from(outfitItems).where(eq(outfitItems.outfitId, outfitId));
  return row?.total ?? 0;
}

function tooManyItems(): AppError {
  return new AppError(400, ErrorCode.VALIDATION_ERROR, `Un outfit admite máximo ${MAX_ITEMS_PER_OUTFIT} prendas.`, {
    maxItems: MAX_ITEMS_PER_OUTFIT,
  });
}

export async function addItem(userId: string, outfitId: string, garmentId: string): Promise<OutfitItemsResult> {
  const outfit = await db.transaction(async (tx) => {
    await requireOwnedOutfit(userId, outfitId, tx, true);
    await requireAvailableGarments([garmentId], tx);

    const [existing] = await tx
      .select({ garmentId: outfitItems.garmentId })
      .from(outfitItems)
      .where(and(eq(outfitItems.outfitId, outfitId), eq(outfitItems.garmentId, garmentId)))
      .limit(1);
    if (existing) throw garmentAlreadyAdded(garmentId);
    if ((await countItems(outfitId, tx)) >= MAX_ITEMS_PER_OUTFIT) throw tooManyItems();

    try {
      await tx.insert(outfitItems).values({ outfitId, garmentId });
    } catch (error) {
      if (isUniqueViolation(error)) throw garmentAlreadyAdded(garmentId);
      throw error;
    }
    await markAsDraft(outfitId, tx);
    return buildOutfit(outfitId, tx);
  });
  return toItemsResult(outfit);
}

function garmentAlreadyAdded(garmentId: string): AppError {
  return new AppError(409, ErrorCode.GARMENT_ALREADY_ADDED, 'La prenda ya está en este outfit.', { garmentId });
}

export async function removeItem(userId: string, outfitId: string, garmentId: string): Promise<OutfitItemsResult> {
  const outfit = await db.transaction(async (tx) => {
    await requireOwnedOutfit(userId, outfitId, tx, true);
    const removed = await tx
      .delete(outfitItems)
      .where(and(eq(outfitItems.outfitId, outfitId), eq(outfitItems.garmentId, garmentId)))
      .returning({ garmentId: outfitItems.garmentId });
    if (removed.length === 0) {
      throw new AppError(404, ErrorCode.GARMENT_NOT_IN_OUTFIT, 'La prenda no está en este outfit.', { garmentId });
    }
    await markAsDraft(outfitId, tx);
    return buildOutfit(outfitId, tx);
  });
  return toItemsResult(outfit);
}

export async function finalizeOutfit(
  userId: string,
  outfitId: string,
  allowOverBudget: boolean,
): Promise<OutfitResponse> {
  return db.transaction(async (tx) => {
    await requireOwnedOutfit(userId, outfitId, tx, true);
    const outfit = await buildOutfit(outfitId, tx);

    const unavailable = outfit.items.filter((item) => !item.available).map((item) => item.id);
    if (unavailable.length > 0) {
      throw new AppError(400, ErrorCode.GARMENT_INACTIVE, 'El outfit tiene prendas que ya no están disponibles.', {
        garmentIds: unavailable,
      });
    }
    if (!outfit.isComplete) {
      throw new AppError(
        400,
        ErrorCode.OUTFIT_INCOMPLETE,
        'El outfit necesita top, bottom y zapatos, o un vestido y zapatos.',
        { missingCategories: outfit.missingCategories },
      );
    }
    if (outfit.budgetStatus === 'over_budget' && !allowOverBudget) {
      throw new AppError(400, ErrorCode.BUDGET_EXCEEDED, 'El outfit supera el presupuesto definido.', {
        budgetCop: outfit.budgetCop,
        totalCop: outfit.totalCop,
      });
    }

    await tx.update(outfits).set({ status: 'saved', savedAt: new Date() }).where(eq(outfits.id, outfitId));
    return buildOutfit(outfitId, tx);
  });
}

export async function applyRecommendation(
  userId: string,
  outfitId: string,
  input: ApplyRecommendationBody,
): Promise<OutfitResponse> {
  return db.transaction(async (tx) => {
    await requireOwnedOutfit(userId, outfitId, tx, true);
    await requireAvailableGarments(input.garmentIds, tx);

    if (input.mode === 'replace') {
      await tx.delete(outfitItems).where(eq(outfitItems.outfitId, outfitId));
    }
    const current = await tx
      .select({ garmentId: outfitItems.garmentId })
      .from(outfitItems)
      .where(and(eq(outfitItems.outfitId, outfitId), inArray(outfitItems.garmentId, input.garmentIds)));
    const alreadyThere = new Set(current.map((row) => row.garmentId));
    const toInsert = input.garmentIds.filter((id) => !alreadyThere.has(id));

    if ((await countItems(outfitId, tx)) + toInsert.length > MAX_ITEMS_PER_OUTFIT) throw tooManyItems();
    if (toInsert.length > 0) {
      await tx.insert(outfitItems).values(toInsert.map((garmentId) => ({ outfitId, garmentId })));
    }
    await markAsDraft(outfitId, tx);
    return buildOutfit(outfitId, tx);
  });
}
