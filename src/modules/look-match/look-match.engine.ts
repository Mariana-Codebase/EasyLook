import type { GarmentCategory } from '../../db/schema';
import { formatCop } from '../../lib/money';
import { computeBudget, evaluateCompleteness, type BudgetStatus } from '../outfits/outfit.rules';
import type { LookMatchConfig } from './look-match.config';

export interface Candidate {
  id: string;
  name: string;
  category: GarmentCategory;
  priceCop: number;
  style: string;
  color: string;
  storeId: string;
  storeName: string;
}

export interface OccasionContext {
  code: string;
  name: string;
  recommendedStyles: string[];
}

export interface LookMatchParams {
  budgetCop: number | null;
  preferredStyles: string[];
  excludedCategories: GarmentCategory[];
  allowOverBudget: boolean;
}

export type RecommendationLabel = 'balanced' | 'budget' | 'statement';

export interface ScoreBreakdown {
  occasion: number;
  style: number;
  budget: number;
  storeVariety: number;
}

export interface Recommendation {
  label: RecommendationLabel;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  pieces: Candidate[];
  totalCop: number;
  remainingCop: number | null;
  budgetStatus: BudgetStatus;
  storeCount: number;
  explanation: string[];
}

export type LookMatchOutcome =
  | {
      kind: 'ok';
      evaluatedCombinations: number;
      withinBudgetFound: boolean;
      notice: string | null;
      recommendations: Recommendation[];
    }
  | { kind: 'no_complete_look'; missingCategories: GarmentCategory[] }
  | { kind: 'over_budget'; budgetCop: number; cheapestTotalCop: number };

interface DescribeContext {
  evaluated: number;
  complement: Candidate | null;
  overBudgetFallback: boolean;
  closeToBest?: boolean;
}

interface ScoredLook {
  pieces: Candidate[];
  totalCop: number;
  score: number;
  breakdown: ScoreBreakdown;
  key: string;
}

const CORE_CATEGORIES: GarmentCategory[] = ['top', 'bottom', 'dress', 'shoes'];
const COMPLEMENT_CATEGORIES: GarmentCategory[] = ['outerwear', 'accessory'];

const round2 = (value: number) => Math.round(value * 100) / 100;
const byId = (a: Candidate, b: Candidate) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function pieceOccasionFit(piece: Candidate, occasion: OccasionContext, config: LookMatchConfig): number {
  return occasion.recommendedStyles.includes(piece.style) ? 1 : config.offStyleOccasionCredit;
}

function pieceStyleFit(piece: Candidate, preferredStyles: string[]): number {
  return preferredStyles.length === 0 || preferredStyles.includes(piece.style) ? 1 : 0;
}

/** Ranks a single piece; used to shortlist candidates before combining them. */
function pieceFit(piece: Candidate, occasion: OccasionContext, params: LookMatchParams, config: LookMatchConfig) {
  const { occasion: wo, style: ws } = config.weights;
  return wo * pieceOccasionFit(piece, occasion, config) + ws * pieceStyleFit(piece, params.preferredStyles);
}

function shortlist(
  pieces: Candidate[],
  occasion: OccasionContext,
  params: LookMatchParams,
  config: LookMatchConfig,
): Candidate[] {
  const bestFit = [...pieces]
    .sort(
      (a, b) =>
        pieceFit(b, occasion, params, config) - pieceFit(a, occasion, params, config) ||
        a.priceCop - b.priceCop ||
        byId(a, b),
    )
    .slice(0, config.shortlistSize);
  // The cheapest pieces are always kept so the "budget" option is the real minimum.
  const cheapest = [...pieces].sort((a, b) => a.priceCop - b.priceCop || byId(a, b)).slice(0, config.shortlistSize);
  return [...new Map([...bestFit, ...cheapest].map((piece) => [piece.id, piece])).values()];
}

function budgetFit(totalCop: number, budgetCop: number | null, config: LookMatchConfig): number {
  if (budgetCop === null) return 1;
  if (budgetCop === 0) return totalCop === 0 ? 1 : 0;
  const ratio = totalCop / budgetCop;
  if (ratio > 1) return Math.max(0, 0.5 - (ratio - 1));
  // Inside the budget, a look that uses most of it is a better fit than one that ignores it.
  return 0.5 + 0.5 * Math.min(ratio / config.budgetSweetSpot, 1);
}

export function scoreLook(
  pieces: Candidate[],
  occasion: OccasionContext,
  params: LookMatchParams,
  config: LookMatchConfig,
): { score: number; breakdown: ScoreBreakdown; totalCop: number } {
  const totalCop = pieces.reduce((sum, piece) => sum + piece.priceCop, 0);
  const occasionScore = pieces.reduce((sum, p) => sum + pieceOccasionFit(p, occasion, config), 0) / pieces.length;

  let styleScore: number;
  if (params.preferredStyles.length > 0) {
    styleScore = pieces.filter((p) => params.preferredStyles.includes(p.style)).length / pieces.length;
  } else {
    // Without preferences, style affinity rewards a cohesive look.
    const counts = new Map<string, number>();
    for (const p of pieces) counts.set(p.style, (counts.get(p.style) ?? 0) + 1);
    styleScore = Math.max(...counts.values()) / pieces.length;
  }

  const stores = new Set(pieces.map((p) => p.storeId)).size;
  const varietyScore = pieces.length > 1 ? (stores - 1) / (pieces.length - 1) : 0;
  const budgetScore = budgetFit(totalCop, params.budgetCop, config);

  const { weights } = config;
  const weighted =
    weights.occasion * occasionScore +
    weights.style * styleScore +
    weights.budget * budgetScore +
    weights.storeVariety * varietyScore;

  return {
    score: Math.round(weighted * 100),
    totalCop,
    breakdown: {
      occasion: round2(occasionScore),
      style: round2(styleScore),
      budget: round2(budgetScore),
      storeVariety: round2(varietyScore),
    },
  };
}

function lookKey(pieces: Candidate[]): string {
  return pieces
    .map((p) => p.id)
    .sort()
    .join('|');
}

function sharedPieces(a: ScoredLook, b: ScoredLook): number {
  const ids = new Set(a.pieces.map((p) => p.id));
  return b.pieces.filter((p) => ids.has(p.id)).length;
}

function* combinations(groups: Map<GarmentCategory, Candidate[]>): Generator<Candidate[]> {
  const get = (category: GarmentCategory) => groups.get(category) ?? [];
  for (const shoes of get('shoes')) {
    for (const dress of get('dress')) yield [dress, shoes];
    for (const top of get('top')) {
      for (const bottom of get('bottom')) yield [top, bottom, shoes];
    }
  }
}

/** Picks the first look in `ranked` that is different enough from every look already chosen. */
function pickDistinct(ranked: ScoredLook[], chosen: ScoredLook[], config: LookMatchConfig): ScoredLook | undefined {
  const isNew = (look: ScoredLook) => chosen.every((c) => c.key !== look.key);
  return (
    ranked.find((look) => isNew(look) && chosen.every((c) => sharedPieces(c, look) <= config.maxSharedPieces)) ??
    ranked.find(isNew)
  );
}

function describe(
  label: RecommendationLabel,
  look: ScoredLook,
  occasion: OccasionContext,
  params: LookMatchParams,
  context: DescribeContext,
): string[] {
  const lines: string[] = [];
  const categories = look.pieces.map((p) => p.category);
  const structure = evaluateCompleteness(categories).structure;
  lines.push(
    structure === 'dress_shoes'
      ? 'Incluye las piezas mínimas para un look completo: vestido y zapatos.'
      : 'Incluye las piezas mínimas para un look completo: top, bottom y zapatos.',
  );

  const inOccasionStyle = look.pieces.filter((p) => occasion.recommendedStyles.includes(p.style)).length;
  if (inOccasionStyle === look.pieces.length) {
    lines.push(`Todas las prendas siguen los estilos recomendados para la ocasión "${occasion.name}".`);
  } else {
    lines.push(
      `Todas las prendas están pensadas para la ocasión "${occasion.name}"; ${inOccasionStyle} de ${look.pieces.length} siguen sus estilos recomendados.`,
    );
  }

  if (params.preferredStyles.length > 0) {
    const matches = look.pieces.filter((p) => params.preferredStyles.includes(p.style)).length;
    lines.push(
      matches === look.pieces.length
        ? `Coincide por completo con tus estilos preferidos (${params.preferredStyles.join(', ')}).`
        : `Coincide con tus estilos preferidos en ${matches} de ${look.pieces.length} prendas.`,
    );
  } else {
    const styles = [...new Set(look.pieces.map((p) => p.style))];
    if (styles.length === 1) lines.push(`Mantiene un estilo coherente: ${styles[0]}.`);
  }

  const { remainingCop } = computeBudget(params.budgetCop, [look.totalCop]);
  if (remainingCop === null) {
    lines.push(`No definiste presupuesto; el total es ${formatCop(look.totalCop)}.`);
  } else if (remainingCop >= 0) {
    lines.push(`Se mantiene dentro del presupuesto y te quedan ${formatCop(remainingCop)}.`);
  } else {
    lines.push(
      `Supera el presupuesto por ${formatCop(-remainingCop)}; aparece porque pediste ver la opción más cercana.`,
    );
  }

  const storeCount = new Set(look.pieces.map((p) => p.storeId)).size;
  if (storeCount > 1) lines.push(`Combina prendas de ${storeCount} tiendas.`);

  if (label === 'balanced') {
    lines.push(`Tiene el mejor puntaje general entre ${context.evaluated} combinaciones evaluadas.`);
  } else if (label === 'budget') {
    if (context.overBudgetFallback) {
      lines.push('Es la combinación completa más barata del catálogo para esta ocasión.');
    } else if (context.closeToBest) {
      lines.push('Es la alternativa completa más económica que mantiene un puntaje cercano al mejor.');
    } else {
      lines.push('Es la alternativa completa con menor costo, aunque se aleja más de la ocasión o de tu estilo.');
    }
  } else {
    const hasBudget = params.budgetCop !== null;
    lines.push(
      hasBudget
        ? 'Es la opción más destacada que cabe en el presupuesto.'
        : 'Es la opción más destacada entre las combinaciones con mejor puntaje.',
    );
    if (context.complement) {
      lines.push(
        hasBudget
          ? `Suma ${context.complement.name} como complemento porque todavía cabía en el presupuesto.`
          : `Suma ${context.complement.name} como complemento para terminar el look.`,
      );
    }
  }
  return lines;
}

function toRecommendation(
  label: RecommendationLabel,
  look: ScoredLook,
  occasion: OccasionContext,
  params: LookMatchParams,
  context: DescribeContext,
): Recommendation {
  const budget = computeBudget(params.budgetCop, [look.totalCop]);
  return {
    label,
    score: look.score,
    scoreBreakdown: look.breakdown,
    pieces: look.pieces,
    totalCop: look.totalCop,
    remainingCop: budget.remainingCop,
    budgetStatus: budget.budgetStatus,
    storeCount: new Set(look.pieces.map((p) => p.storeId)).size,
    explanation: describe(label, look, occasion, params, context),
  };
}

function withComplement(
  look: ScoredLook,
  complements: Candidate[],
  occasion: OccasionContext,
  params: LookMatchParams,
  config: LookMatchConfig,
): { look: ScoredLook; complement: Candidate | null } {
  const room = params.budgetCop === null ? Number.POSITIVE_INFINITY : params.budgetCop - look.totalCop;
  const complement = complements
    .filter((p) => p.priceCop <= room)
    .sort(
      (a, b) =>
        pieceFit(b, occasion, params, config) - pieceFit(a, occasion, params, config) ||
        a.priceCop - b.priceCop ||
        byId(a, b),
    )[0];
  if (!complement) return { look, complement: null };
  const pieces = [...look.pieces, complement];
  const scored = scoreLook(pieces, occasion, params, config);
  return {
    look: { pieces, totalCop: scored.totalCop, score: scored.score, breakdown: scored.breakdown, key: lookKey(pieces) },
    complement,
  };
}

/**
 * Look Match (spec section 13). Pure and deterministic: the same catalog and request
 * always produce the same recommendations, which is what makes them testable and explainable.
 */
export function runLookMatch(
  candidates: Candidate[],
  occasion: OccasionContext,
  params: LookMatchParams,
  config: LookMatchConfig,
): LookMatchOutcome {
  const excluded = new Set(params.excludedCategories);
  const allowed = candidates.filter((c) => !excluded.has(c.category));

  const groups = new Map<GarmentCategory, Candidate[]>();
  for (const category of CORE_CATEGORIES) {
    const pieces = allowed.filter((c) => c.category === category);
    if (pieces.length > 0) groups.set(category, shortlist(pieces, occasion, params, config));
  }

  const completeness = evaluateCompleteness([...groups.keys()]);
  if (!completeness.isComplete) {
    return { kind: 'no_complete_look', missingCategories: completeness.missingCategories };
  }

  const withinBudget: ScoredLook[] = [];
  let cheapest: Candidate[] | null = null;
  let cheapestTotal = Number.POSITIVE_INFINITY;
  let evaluated = 0;

  for (const pieces of combinations(groups)) {
    evaluated += 1;
    const total = pieces.reduce((sum, p) => sum + p.priceCop, 0);
    if (total < cheapestTotal || (total === cheapestTotal && cheapest && lookKey(pieces) < lookKey(cheapest))) {
      cheapestTotal = total;
      cheapest = pieces;
    }
    if (params.budgetCop !== null && total > params.budgetCop) continue;
    const scored = scoreLook(pieces, occasion, params, config);
    withinBudget.push({ pieces, ...scored, key: lookKey(pieces) });
  }

  if (withinBudget.length === 0) {
    const budgetCop = params.budgetCop ?? 0;
    if (!params.allowOverBudget || !cheapest) {
      return { kind: 'over_budget', budgetCop, cheapestTotalCop: cheapestTotal };
    }
    const scored = scoreLook(cheapest, occasion, params, config);
    const look: ScoredLook = { pieces: cheapest, ...scored, key: lookKey(cheapest) };
    return {
      kind: 'ok',
      evaluatedCombinations: evaluated,
      withinBudgetFound: false,
      notice: `No hay un look completo dentro de ${formatCop(budgetCop)}. Esta es la opción más cercana.`,
      recommendations: [
        toRecommendation('budget', look, occasion, params, { evaluated, complement: null, overBudgetFallback: true }),
      ],
    };
  }

  const byScore = [...withinBudget].sort((a, b) => b.score - a.score || a.totalCop - b.totalCop || (a.key < b.key ? -1 : 1));
  const byPriceAsc = [...withinBudget].sort((a, b) => a.totalCop - b.totalCop || b.score - a.score || (a.key < b.key ? -1 : 1));

  const balanced = byScore[0]!;
  const chosen: ScoredLook[] = [balanced];
  const recommendations: Recommendation[] = [
    toRecommendation('balanced', balanced, occasion, params, { evaluated, complement: null, overBudgetFallback: false }),
  ];

  const isCloseToBest = (look: ScoredLook) => look.score >= balanced.score - config.alternativeScoreTolerance;
  const cheaper = byPriceAsc.filter((look) => look.totalCop < balanced.totalCop);
  const budgetLook = pickDistinct(cheaper.filter(isCloseToBest), chosen, config) ?? pickDistinct(cheaper, chosen, config);
  if (budgetLook) {
    chosen.push(budgetLook);
    recommendations.push(
      toRecommendation('budget', budgetLook, occasion, params, {
        evaluated,
        complement: null,
        overBudgetFallback: false,
        closeToBest: isCloseToBest(budgetLook),
      }),
    );
  }

  const statementPool = withinBudget
    .filter(isCloseToBest)
    .sort((a, b) => b.totalCop - a.totalCop || b.score - a.score || (a.key < b.key ? -1 : 1));
  const statementBase = pickDistinct(statementPool, chosen, config);
  if (statementBase) {
    const complements = allowed.filter((c) => COMPLEMENT_CATEGORIES.includes(c.category));
    const { look, complement } = withComplement(statementBase, complements, occasion, params, config);
    recommendations.push(
      toRecommendation('statement', look, occasion, params, { evaluated, complement, overBudgetFallback: false }),
    );
  }

  return { kind: 'ok', evaluatedCombinations: evaluated, withinBudgetFound: true, notice: null, recommendations };
}
