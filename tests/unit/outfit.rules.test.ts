import { computeBudget, countStores, evaluateCompleteness } from '../../src/modules/outfits/outfit.rules';

describe('computeBudget (rules 4 and 5)', () => {
  it('reports not_set and no remaining amount when there is no budget', () => {
    expect(computeBudget(null, [149900, 50000])).toEqual({
      totalCop: 199900,
      remainingCop: null,
      budgetStatus: 'not_set',
    });
  });

  it('is within budget when the total is lower or equal', () => {
    expect(computeBudget(350000, [149900])).toEqual({
      totalCop: 149900,
      remainingCop: 200100,
      budgetStatus: 'within_budget',
    });
    expect(computeBudget(100, [60, 40]).budgetStatus).toBe('within_budget');
  });

  it('is over budget with a negative remaining amount', () => {
    expect(computeBudget(300000, [200000, 126000])).toEqual({
      totalCop: 326000,
      remainingCop: -26000,
      budgetStatus: 'over_budget',
    });
  });

  it('handles an empty outfit', () => {
    expect(computeBudget(350000, [])).toEqual({ totalCop: 0, remainingCop: 350000, budgetStatus: 'within_budget' });
  });
});

describe('evaluateCompleteness (rule 3)', () => {
  it('accepts top + bottom + shoes', () => {
    expect(evaluateCompleteness(['top', 'bottom', 'shoes'])).toEqual({
      isComplete: true,
      structure: 'top_bottom_shoes',
      missingCategories: [],
    });
  });

  it('accepts dress + shoes, with extras', () => {
    const result = evaluateCompleteness(['dress', 'accessory', 'shoes', 'outerwear']);
    expect(result.isComplete).toBe(true);
    expect(result.structure).toBe('dress_shoes');
  });

  it('lists what is missing for an empty outfit', () => {
    expect(evaluateCompleteness([]).missingCategories).toEqual(['top', 'bottom', 'shoes']);
  });

  it('asks only for the missing half of the separates', () => {
    expect(evaluateCompleteness(['top', 'shoes']).missingCategories).toEqual(['bottom']);
    expect(evaluateCompleteness(['bottom']).missingCategories).toEqual(['top', 'shoes']);
  });

  it('asks for shoes when a dress is present', () => {
    expect(evaluateCompleteness(['dress']).missingCategories).toEqual(['shoes']);
  });

  it('does not count outerwear or accessories as a base', () => {
    expect(evaluateCompleteness(['outerwear', 'accessory', 'shoes']).isComplete).toBe(false);
  });
});

describe('countStores', () => {
  it('counts distinct stores', () => {
    expect(countStores(['a', 'b', 'a'])).toBe(2);
    expect(countStores([])).toBe(0);
  });
});
