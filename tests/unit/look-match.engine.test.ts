import type { GarmentCategory } from '../../src/db/schema';
import { lookMatchConfig } from '../../src/modules/look-match/look-match.config';
import {
  runLookMatch,
  scoreLook,
  type Candidate,
  type LookMatchParams,
  type OccasionContext,
} from '../../src/modules/look-match/look-match.engine';
import { filterBySizes } from '../../src/modules/look-match/look-match.sizes';

const piece = (
  id: string,
  category: GarmentCategory,
  priceCop: number,
  style: string,
  storeId: string,
): Candidate => ({ id, name: id, category, priceCop, style, color: 'negro', storeId, storeName: `Tienda ${storeId}` });

const catalog: Candidate[] = [
  piece('top-elegant', 'top', 100_000, 'elegant', 'A'),
  piece('top-casual', 'top', 40_000, 'casual', 'B'),
  piece('bottom-elegant', 'bottom', 120_000, 'elegant', 'B'),
  piece('bottom-casual', 'bottom', 50_000, 'casual', 'B'),
  piece('dress-elegant', 'dress', 250_000, 'elegant', 'A'),
  piece('shoes-elegant', 'shoes', 150_000, 'elegant', 'C'),
  piece('shoes-casual', 'shoes', 60_000, 'casual', 'B'),
  piece('coat-elegant', 'outerwear', 80_000, 'elegant', 'A'),
  piece('earrings-elegant', 'accessory', 30_000, 'elegant', 'C'),
];

const date: OccasionContext = { code: 'date', name: 'Cita', recommendedStyles: ['elegant', 'minimal'] };

const params = (overrides: Partial<LookMatchParams> = {}): LookMatchParams => ({
  budgetCop: 400_000,
  preferredStyles: [],
  excludedCategories: [],
  allowOverBudget: false,
  ...overrides,
});

const byIds = (...ids: string[]) => ids.map((id) => catalog.find((c) => c.id === id)!);

function okOutcome(outcome: ReturnType<typeof runLookMatch>) {
  if (outcome.kind !== 'ok') throw new Error(`Expected ok, got ${outcome.kind}`);
  return outcome;
}

describe('scoreLook', () => {
  it('gives 100 to a look that fits occasion, style, budget and store variety', () => {
    const result = scoreLook(byIds('top-elegant', 'bottom-elegant', 'shoes-elegant'), date, params(), lookMatchConfig);
    expect(result.totalCop).toBe(370_000);
    expect(result.breakdown).toEqual({ occasion: 1, style: 1, budget: 1, storeVariety: 1 });
    expect(result.score).toBe(100);
  });

  it('applies the 40/30/20/10 weights', () => {
    const result = scoreLook(byIds('top-casual', 'bottom-casual', 'shoes-casual'), date, params(), lookMatchConfig);
    // occasion 0.5 (off-style), style 1 (cohesive), budget 0.5 + 0.5 * (0.375 / 0.9), one store.
    expect(result.breakdown.occasion).toBe(0.5);
    expect(result.breakdown.storeVariety).toBe(0);
    expect(result.score).toBe(Math.round((0.4 * 0.5 + 0.3 * 1 + 0.2 * (0.5 + 0.5 * (0.375 / 0.9))) * 100));
  });

  it('measures style affinity against the preferred styles when given', () => {
    const look = byIds('top-elegant', 'bottom-casual', 'shoes-casual');
    const result = scoreLook(look, date, params({ preferredStyles: ['casual'] }), lookMatchConfig);
    expect(result.breakdown.style).toBe(0.67);
  });

  it('gives a neutral budget score when there is no budget', () => {
    const result = scoreLook(byIds('dress-elegant', 'shoes-casual'), date, params({ budgetCop: null }), lookMatchConfig);
    expect(result.breakdown.budget).toBe(1);
  });
});

describe('runLookMatch', () => {
  it('returns up to three distinct labelled looks, all complete and within budget', () => {
    const outcome = okOutcome(runLookMatch(catalog, date, params(), lookMatchConfig));
    const labels = outcome.recommendations.map((r) => r.label);
    expect(labels[0]).toBe('balanced');
    expect(new Set(labels).size).toBe(labels.length);
    expect(outcome.recommendations.length).toBeLessThanOrEqual(3);

    const keys = new Set(outcome.recommendations.map((r) => r.pieces.map((p) => p.id).sort().join('|')));
    expect(keys.size).toBe(outcome.recommendations.length);

    for (const rec of outcome.recommendations) {
      const categories = rec.pieces.map((p) => p.category);
      const complete =
        categories.includes('shoes') &&
        (categories.includes('dress') || (categories.includes('top') && categories.includes('bottom')));
      expect(complete).toBe(true);
      expect(rec.totalCop).toBeLessThanOrEqual(400_000);
      expect(rec.budgetStatus).toBe('within_budget');
      expect(rec.explanation.length).toBeGreaterThan(2);
    }
  });

  it('ranks the best fitting look as balanced', () => {
    const outcome = okOutcome(runLookMatch(catalog, date, params(), lookMatchConfig));
    expect(outcome.recommendations[0]!.pieces.map((p) => p.id)).toEqual([
      'top-elegant',
      'bottom-elegant',
      'shoes-elegant',
    ]);
    expect(outcome.recommendations[0]!.score).toBe(100);
  });

  it('makes the budget option cheaper than the balanced one', () => {
    const outcome = okOutcome(runLookMatch(catalog, date, params(), lookMatchConfig));
    const balanced = outcome.recommendations.find((r) => r.label === 'balanced')!;
    const budget = outcome.recommendations.find((r) => r.label === 'budget');
    expect(budget).toBeDefined();
    expect(budget!.totalCop).toBeLessThan(balanced.totalCop);
  });

  it('only adds a complement to the statement look when it still fits the budget', () => {
    const outcome = okOutcome(runLookMatch(catalog, date, params({ budgetCop: 1_000_000 }), lookMatchConfig));
    const statement = outcome.recommendations.find((r) => r.label === 'statement')!;
    expect(statement.pieces.some((p) => ['outerwear', 'accessory'].includes(p.category))).toBe(true);
    expect(statement.totalCop).toBeLessThanOrEqual(1_000_000);
  });

  it('never uses excluded categories', () => {
    const outcome = okOutcome(
      runLookMatch(catalog, date, params({ budgetCop: 1_000_000, excludedCategories: ['dress', 'outerwear'] }), lookMatchConfig),
    );
    for (const rec of outcome.recommendations) {
      expect(rec.pieces.some((p) => p.category === 'dress' || p.category === 'outerwear')).toBe(false);
    }
  });

  it('reports missing categories when no complete look can be formed', () => {
    const outcome = runLookMatch(catalog, date, params({ excludedCategories: ['shoes'] }), lookMatchConfig);
    expect(outcome).toEqual({ kind: 'no_complete_look', missingCategories: ['shoes'] });
  });

  it('reports the cheapest total when the budget is too low', () => {
    const outcome = runLookMatch(catalog, date, params({ budgetCop: 100_000 }), lookMatchConfig);
    expect(outcome).toEqual({ kind: 'over_budget', budgetCop: 100_000, cheapestTotalCop: 150_000 });
  });

  it('returns only the closest look when allowOverBudget is requested', () => {
    const outcome = okOutcome(
      runLookMatch(catalog, date, params({ budgetCop: 100_000, allowOverBudget: true }), lookMatchConfig),
    );
    expect(outcome.withinBudgetFound).toBe(false);
    expect(outcome.notice).toContain('opción más cercana');
    expect(outcome.recommendations).toHaveLength(1);
    expect(outcome.recommendations[0]).toMatchObject({
      label: 'budget',
      totalCop: 150_000,
      remainingCop: -50_000,
      budgetStatus: 'over_budget',
    });
  });

  it('lets preferred styles change the ranking without overriding the occasion', () => {
    const neutral = okOutcome(runLookMatch(catalog, date, params(), lookMatchConfig)).recommendations[0]!;
    const casual = okOutcome(runLookMatch(catalog, date, params({ preferredStyles: ['casual'] }), lookMatchConfig))
      .recommendations[0]!;
    expect(casual.pieces.map((p) => p.id)).not.toEqual(neutral.pieces.map((p) => p.id));
    expect(casual.pieces.some((p) => p.style === 'casual')).toBe(true);
    // Occasion weighs 40% and style 30%, so an all-casual look does not win a date.
    expect(casual.pieces.every((p) => p.style === 'casual')).toBe(false);
  });

  it('is deterministic regardless of the candidate order', () => {
    const first = runLookMatch(catalog, date, params(), lookMatchConfig);
    const shuffled = [...catalog].reverse();
    const second = runLookMatch(shuffled, date, params(), lookMatchConfig);
    expect(second).toEqual(first);
  });

  it('keeps the cheapest pieces in the shortlist so the budget option is real', () => {
    const many: Candidate[] = [
      ...Array.from({ length: 30 }, (_, i) => piece(`top-${i}`, 'top', 200_000 + i, 'elegant', 'A')),
      piece('top-cheap', 'top', 10_000, 'casual', 'B'),
      piece('bottom-1', 'bottom', 50_000, 'elegant', 'B'),
      piece('shoes-1', 'shoes', 50_000, 'elegant', 'C'),
    ];
    const outcome = runLookMatch(many, date, params({ budgetCop: 150_000 }), lookMatchConfig);
    expect(okOutcome(outcome).recommendations[0]!.pieces.map((p) => p.id)).toContain('top-cheap');
  });
});

describe('filterBySizes', () => {
  const items = [
    { id: 'shirt-s', category: 'top', sizes: ['S'] },
    { id: 'shirt-m', category: 'top', sizes: ['M', 'L'] },
    { id: 'shoe-37', category: 'shoes', sizes: ['36', '37'] },
    { id: 'shoe-39', category: 'shoes', sizes: ['39'] },
    { id: 'bag', category: 'accessory', sizes: [] },
  ];

  it('keeps everything without requested sizes', () => {
    expect(filterBySizes(items, [])).toHaveLength(items.length);
  });

  it('filters each category only by the sizes that exist in it', () => {
    const ids = filterBySizes(items, ['37']).map((i) => i.id);
    expect(ids).toEqual(['shirt-s', 'shirt-m', 'shoe-37', 'bag']);
  });

  it('combines clothing and shoe sizes', () => {
    const ids = filterBySizes(items, ['M', '39']).map((i) => i.id);
    expect(ids).toEqual(['shirt-m', 'shoe-39', 'bag']);
  });
});
