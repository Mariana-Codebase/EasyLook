import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { garments, stores, users } from '../../db/schema';
import { AppError, ErrorCode } from '../../lib/errors';
import { CURRENCY, formatCop } from '../../lib/money';
import { availableGarmentFilter, occasionFilter } from '../catalog/garments.service';
import { requireActiveOccasion } from '../catalog/occasions.service';
import { lookMatchConfig } from './look-match.config';
import { runLookMatch, type Candidate } from './look-match.engine';
import { filterBySizes } from './look-match.sizes';
import type { LookMatchRequest, LookMatchResponse } from './look-match.schemas';

async function resolvePreferences(input: LookMatchRequest, userId: string | undefined) {
  let preferredStyles = input.preferredStyles;
  let sizes = input.sizes;
  let source: 'request' | 'profile' | 'none' = preferredStyles || sizes ? 'request' : 'none';

  if (userId && (preferredStyles === undefined || sizes === undefined)) {
    const [profile] = await db
      .select({ preferredStyles: users.preferredStyles, preferredSizes: users.preferredSizes })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (profile) {
      if (preferredStyles === undefined && profile.preferredStyles.length > 0) {
        preferredStyles = profile.preferredStyles;
        source = source === 'request' ? 'request' : 'profile';
      }
      if (sizes === undefined && profile.preferredSizes.length > 0) {
        sizes = profile.preferredSizes;
        source = source === 'request' ? 'request' : 'profile';
      }
    }
  }
  return { preferredStyles: [...new Set(preferredStyles ?? [])], sizes: [...new Set(sizes ?? [])], source };
}

type SizedCandidate = Candidate & { sizes: string[] };

async function loadCandidates(occasionCode: string, sizes: string[]): Promise<Candidate[]> {
  const rows: SizedCandidate[] = await db
    .select({
      id: garments.id,
      name: garments.name,
      category: garments.category,
      priceCop: garments.priceCop,
      style: garments.style,
      color: garments.color,
      sizes: garments.sizes,
      storeId: stores.id,
      storeName: stores.name,
    })
    .from(garments)
    .innerJoin(stores, eq(stores.id, garments.storeId))
    .where(and(availableGarmentFilter, occasionFilter(occasionCode)));
  return filterBySizes(rows, sizes).map(({ sizes: _sizes, ...candidate }) => candidate);
}

export async function recommendLooks(input: LookMatchRequest, userId?: string): Promise<LookMatchResponse> {
  const occasion = await requireActiveOccasion(input.occasionCode);
  const preferences = await resolvePreferences(input, userId);
  const candidates = await loadCandidates(occasion.code, preferences.sizes);
  const budgetCop = input.budgetCop ?? null;

  const outcome = runLookMatch(
    candidates,
    { code: occasion.code, name: occasion.name, recommendedStyles: occasion.recommendedStyles },
    {
      budgetCop,
      preferredStyles: preferences.preferredStyles,
      excludedCategories: input.excludedCategories,
      allowOverBudget: input.allowOverBudget,
    },
    lookMatchConfig,
  );

  if (outcome.kind === 'no_complete_look') {
    throw new AppError(422, ErrorCode.NO_MATCH_FOUND, 'No hay prendas suficientes para formar un look completo con esos filtros.', {
      reason: 'MISSING_CATEGORIES',
      missingCategories: outcome.missingCategories,
    });
  }
  if (outcome.kind === 'over_budget') {
    throw new AppError(
      422,
      ErrorCode.NO_MATCH_FOUND,
      `No hay un look completo dentro de ${formatCop(outcome.budgetCop)}. El más económico cuesta ${formatCop(outcome.cheapestTotalCop)}.`,
      {
        reason: 'BUDGET_TOO_LOW',
        budgetCop: outcome.budgetCop,
        cheapestTotalCop: outcome.cheapestTotalCop,
        hint: 'Sube el presupuesto o envía allowOverBudget=true para ver la opción más cercana.',
      },
    );
  }

  return {
    occasion: occasion.code,
    budgetCop,
    currency: CURRENCY,
    appliedPreferences: preferences,
    evaluatedCombinations: outcome.evaluatedCombinations,
    withinBudgetFound: outcome.withinBudgetFound,
    notice: outcome.notice,
    recommendations: outcome.recommendations.map((rec) => ({
      label: rec.label,
      score: rec.score,
      scoreBreakdown: rec.scoreBreakdown,
      totalCop: rec.totalCop,
      remainingCop: rec.remainingCop,
      budgetStatus: rec.budgetStatus,
      storeCount: rec.storeCount,
      garmentIds: rec.pieces.map((piece) => piece.id),
      items: rec.pieces.map((piece) => ({
        id: piece.id,
        name: piece.name,
        category: piece.category,
        priceCop: piece.priceCop,
        style: piece.style,
        color: piece.color,
        store: { id: piece.storeId, name: piece.storeName },
      })),
      explanation: rec.explanation,
    })),
  };
}
