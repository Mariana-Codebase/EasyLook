import type { GarmentCategory } from '../../db/schema';

export type BudgetStatus = 'not_set' | 'within_budget' | 'over_budget';

export interface BudgetSummary {
  totalCop: number;
  remainingCop: number | null;
  budgetStatus: BudgetStatus;
}

/** Business rules 4 and 5: total is the sum of prices, remaining is budget minus total. */
export function computeBudget(budgetCop: number | null, prices: number[]): BudgetSummary {
  const totalCop = prices.reduce((sum, price) => sum + price, 0);
  if (budgetCop === null) return { totalCop, remainingCop: null, budgetStatus: 'not_set' };
  const remainingCop = budgetCop - totalCop;
  return { totalCop, remainingCop, budgetStatus: remainingCop < 0 ? 'over_budget' : 'within_budget' };
}

export type OutfitStructure = 'top_bottom_shoes' | 'dress_shoes';

export interface Completeness {
  isComplete: boolean;
  structure: OutfitStructure | null;
  missingCategories: GarmentCategory[];
}

/**
 * Business rule 3: an outfit is complete with a top, a bottom and shoes, or with a dress and shoes.
 * When incomplete, `missingCategories` lists the cheapest path to completion given what is already there.
 */
export function evaluateCompleteness(categories: readonly GarmentCategory[]): Completeness {
  const has = new Set(categories);
  const missing: GarmentCategory[] = [];

  const hasDressBase = has.has('dress');
  const hasSeparatesBase = has.has('top') && has.has('bottom');

  if (!hasDressBase && !hasSeparatesBase) {
    if (has.has('top')) missing.push('bottom');
    else if (has.has('bottom')) missing.push('top');
    else missing.push('top', 'bottom');
  }
  if (!has.has('shoes')) missing.push('shoes');

  if (missing.length > 0) return { isComplete: false, structure: null, missingCategories: missing };
  return { isComplete: true, structure: hasDressBase ? 'dress_shoes' : 'top_bottom_shoes', missingCategories: [] };
}

export function countStores(storeIds: readonly string[]): number {
  return new Set(storeIds).size;
}

export const MAX_ITEMS_PER_OUTFIT = 12;
