import { paginationQuerySchema } from '../../lib/pagination';
import {
  budgetCopSchema,
  categorySchema,
  currencySchema,
  pageMetaSchema,
  slugSchema,
  uuidSchema,
  z,
} from '../../lib/schemas';
import { MAX_ITEMS_PER_OUTFIT } from './outfit.rules';

export const createOutfitBodySchema = z
  .object({
    name: z.string().trim().min(2).max(80).openapi({ example: 'Brunch de domingo' }),
    occasionCode: slugSchema.openapi({ example: 'brunch' }),
    budgetCop: budgetCopSchema.optional(),
    currency: currencySchema.optional(),
  })
  .openapi('CreateOutfitRequest');

export const updateOutfitBodySchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    occasionCode: slugSchema.optional(),
    budgetCop: budgetCopSchema.nullable().optional().openapi({ description: 'Envía `null` para quitar el presupuesto.' }),
  })
  .refine((value) => Object.keys(value).length > 0, 'Envía al menos un campo para actualizar.')
  .openapi('UpdateOutfitRequest');

export const outfitListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['draft', 'saved']).optional().openapi({ description: 'Usa `saved` para ver solo el look book.' }),
  occasion: slugSchema.optional(),
});

export const addItemBodySchema = z
  .object({ garmentId: uuidSchema.openapi({ example: '28a58b2a-c847-44d4-a2ca-ec1dc35b1001' }) })
  .openapi('AddOutfitItemRequest');

export const finalizeBodySchema = z
  .object({
    allowOverBudget: z
      .boolean()
      .default(false)
      .openapi({ description: 'Permite guardar aunque el total supere el presupuesto.' }),
  })
  .openapi('FinalizeOutfitRequest');

export const applyRecommendationBodySchema = z
  .object({
    garmentIds: z
      .array(uuidSchema)
      .min(1)
      .max(MAX_ITEMS_PER_OUTFIT)
      .refine((ids) => new Set(ids).size === ids.length, 'Una prenda solo puede aparecer una vez.'),
    mode: z
      .enum(['replace', 'append'])
      .default('replace')
      .openapi({ description: '`replace` reemplaza las prendas actuales; `append` agrega las que falten.' }),
  })
  .openapi('ApplyRecommendationRequest');

export const outfitItemSchema = z
  .object({
    id: z.uuid(),
    name: z.string().openapi({ example: 'Blazer crema' }),
    category: categorySchema,
    priceCop: z.number().int().openapi({ example: 149900 }),
    style: z.string(),
    color: z.string(),
    available: z.boolean().openapi({ description: 'Falso si la prenda o su tienda fueron desactivadas.' }),
    store: z.object({ id: z.uuid(), name: z.string().openapi({ example: 'Atelier Norte' }) }),
  })
  .openapi('OutfitItem');

const budgetFields = {
  totalCop: z.number().int(),
  remainingCop: z.number().int().nullable(),
  budgetStatus: z.enum(['not_set', 'within_budget', 'over_budget']),
};

const completenessFields = {
  isComplete: z.boolean(),
  missingCategories: z.array(categorySchema),
};

const occasionRefSchema = z.object({ code: z.string(), name: z.string() }).openapi('OccasionRef');

export const outfitSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    occasion: occasionRefSchema,
    budgetCop: z.number().int().nullable(),
    currency: z.literal('COP'),
    ...budgetFields,
    status: z.enum(['draft', 'saved']),
    ...completenessFields,
    storeCount: z.number().int(),
    itemCount: z.number().int(),
    items: z.array(outfitItemSchema),
    createdAt: z.string(),
    updatedAt: z.string(),
    savedAt: z.string().nullable(),
  })
  .openapi('Outfit');

export const outfitItemsResultSchema = z
  .object({
    outfitId: z.uuid(),
    ...budgetFields,
    ...completenessFields,
    storeCount: z.number().int(),
    items: z.array(outfitItemSchema),
  })
  .openapi('OutfitItemsResult');

export const outfitSummarySchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    occasion: occasionRefSchema,
    budgetCop: z.number().int().nullable(),
    currency: z.literal('COP'),
    ...budgetFields,
    status: z.enum(['draft', 'saved']),
    itemCount: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
    savedAt: z.string().nullable(),
  })
  .openapi('OutfitSummary');

export const outfitPageSchema = z
  .object({ data: z.array(outfitSummarySchema), meta: pageMetaSchema })
  .openapi('OutfitPage');

export type CreateOutfitBody = z.infer<typeof createOutfitBodySchema>;
export type UpdateOutfitBody = z.infer<typeof updateOutfitBodySchema>;
export type OutfitListQuery = z.infer<typeof outfitListQuerySchema>;
export type ApplyRecommendationBody = z.infer<typeof applyRecommendationBodySchema>;
export type OutfitResponse = z.infer<typeof outfitSchema>;
export type OutfitItemResponse = z.infer<typeof outfitItemSchema>;
export type OutfitItemsResult = z.infer<typeof outfitItemsResultSchema>;
export type OutfitSummary = z.infer<typeof outfitSummarySchema>;
