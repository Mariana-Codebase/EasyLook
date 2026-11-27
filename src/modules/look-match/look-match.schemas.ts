import { budgetCopSchema, categorySchema, currencySchema, sizeSchema, slugSchema, z } from '../../lib/schemas';

export const lookMatchRequestSchema = z
  .object({
    occasionCode: slugSchema.openapi({ example: 'date' }),
    budgetCop: budgetCopSchema.optional().openapi({ example: 400000 }),
    currency: currencySchema.optional(),
    preferredStyles: z
      .array(slugSchema)
      .max(10)
      .optional()
      .openapi({
        example: ['elegant', 'minimal'],
        description: 'Si no se envía y hay sesión iniciada, se usan las preferencias del perfil.',
      }),
    excludedCategories: z.array(categorySchema).max(6).default([]).openapi({ example: ['outerwear'] }),
    sizes: z
      .array(sizeSchema)
      .max(10)
      .optional()
      .openapi({ description: 'Solo considera prendas disponibles en alguna de estas tallas.', example: ['M', '38'] }),
    allowOverBudget: z.boolean().default(false),
  })
  .openapi('LookMatchRequest');

export const recommendationItemSchema = z
  .object({
    id: z.uuid(),
    name: z.string().openapi({ example: 'Top satinado' }),
    category: categorySchema,
    priceCop: z.number().int(),
    style: z.string(),
    color: z.string(),
    store: z.object({ id: z.uuid(), name: z.string() }),
  })
  .openapi('RecommendationItem');

export const recommendationSchema = z
  .object({
    label: z.enum(['balanced', 'budget', 'statement']),
    score: z.number().int().min(0).max(100).openapi({ example: 92 }),
    scoreBreakdown: z
      .object({
        occasion: z.number(),
        style: z.number(),
        budget: z.number(),
        storeVariety: z.number(),
      })
      .openapi({ description: 'Puntaje de 0 a 1 por criterio antes de aplicar los pesos 40/30/20/10.' }),
    totalCop: z.number().int().openapi({ example: 372000 }),
    remainingCop: z.number().int().nullable().openapi({ example: 28000 }),
    budgetStatus: z.enum(['not_set', 'within_budget', 'over_budget']),
    storeCount: z.number().int(),
    garmentIds: z.array(z.uuid()).openapi({ description: 'Listo para enviar a apply-recommendation.' }),
    items: z.array(recommendationItemSchema),
    explanation: z.array(z.string()),
  })
  .openapi('Recommendation');

export const lookMatchResponseSchema = z
  .object({
    occasion: z.string().openapi({ example: 'date' }),
    budgetCop: z.number().int().nullable(),
    currency: z.literal('COP'),
    appliedPreferences: z.object({
      preferredStyles: z.array(z.string()),
      sizes: z.array(z.string()),
      source: z.enum(['request', 'profile', 'none']),
    }),
    evaluatedCombinations: z.number().int(),
    withinBudgetFound: z.boolean(),
    notice: z.string().nullable(),
    recommendations: z.array(recommendationSchema),
  })
  .openapi('LookMatchResponse');

export type LookMatchRequest = z.infer<typeof lookMatchRequestSchema>;
export type LookMatchResponse = z.infer<typeof lookMatchResponseSchema>;
