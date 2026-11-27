/**
 * Tunable rules for Look Match. Changing these values changes the recommendations
 * without touching the engine, which keeps the scoring transparent and reproducible.
 */
export interface LookMatchConfig {
  /** Weights from section 13 of the spec. They must add up to 1. */
  weights: {
    occasion: number;
    style: number;
    budget: number;
    storeVariety: number;
  };
  /**
   * Credit (0..1) for a piece tagged for the occasion whose style is not one of the
   * occasion's recommended styles. Pieces in a recommended style get full credit.
   */
  offStyleOccasionCredit: number;
  /** Share of the budget a look should use to get the full budget score. */
  budgetSweetSpot: number;
  /** Per core category, the engine keeps this many best-fitting and this many cheapest pieces. */
  shortlistSize: number;
  /**
   * The budget and statement alternatives may score at most this many points below the
   * balanced look, so a cheaper or more striking option is never a poor match.
   */
  alternativeScoreTolerance: number;
  /** Two looks are considered different enough when they share at most this many pieces. */
  maxSharedPieces: number;
}

export const lookMatchConfig: LookMatchConfig = {
  weights: { occasion: 0.4, style: 0.3, budget: 0.2, storeVariety: 0.1 },
  offStyleOccasionCredit: 0.5,
  budgetSweetSpot: 0.9,
  shortlistSize: 12,
  alternativeScoreTolerance: 20,
  maxSharedPieces: 1,
};
