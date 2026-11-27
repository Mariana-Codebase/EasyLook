import { paginationQuerySchema } from '../../lib/pagination';
import {
  categorySchema,
  pageMetaSchema,
  priceCopSchema,
  queryBoolean,
  sizeSchema,
  slugSchema,
  uuidSchema,
  z,
} from '../../lib/schemas';

const searchSchema = z.string().trim().min(1).max(80).optional();
const atLeastOneField = (value: object) => Object.keys(value).length > 0;
const atLeastOneFieldMessage = 'Envía al menos un campo para actualizar.';

// Stores

export const storeListQuerySchema = paginationQuerySchema.extend({
  style: slugSchema.optional(),
  q: searchSchema,
  includeInactive: queryBoolean.openapi({ description: 'Solo administradores.' }),
});

export const createStoreBodySchema = z
  .object({
    name: z.string().trim().min(2).max(80).openapi({ example: 'Atelier Norte' }),
    description: z.string().trim().max(500).default(''),
    style: slugSchema.openapi({ example: 'elegant' }),
    active: z.boolean().default(true),
  })
  .openapi('CreateStoreRequest');

export const updateStoreBodySchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(500).optional(),
    style: slugSchema.optional(),
    active: z.boolean().optional(),
  })
  .refine(atLeastOneField, atLeastOneFieldMessage)
  .openapi('UpdateStoreRequest');

export const storeSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    description: z.string(),
    style: z.string(),
    active: z.boolean(),
    garmentCount: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Store');

export const storePageSchema = z.object({ data: z.array(storeSchema), meta: pageMetaSchema }).openapi('StorePage');

// Occasions

export const occasionListQuerySchema = z.object({
  includeInactive: queryBoolean.openapi({ description: 'Solo administradores.' }),
});

export const createOccasionBodySchema = z
  .object({
    code: slugSchema.openapi({ example: 'graduation' }),
    name: z.string().trim().min(2).max(60).openapi({ example: 'Grado' }),
    description: z.string().trim().max(300).default(''),
    recommendedStyles: z.array(slugSchema).max(10).default([]).openapi({ example: ['elegant', 'classic'] }),
    active: z.boolean().default(true),
  })
  .openapi('CreateOccasionRequest');

export const updateOccasionBodySchema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    description: z.string().trim().max(300).optional(),
    recommendedStyles: z.array(slugSchema).max(10).optional(),
    active: z.boolean().optional(),
  })
  .refine(atLeastOneField, atLeastOneFieldMessage)
  .openapi('UpdateOccasionRequest');

export const occasionSchema = z
  .object({
    id: z.uuid(),
    code: z.string().openapi({ example: 'brunch' }),
    name: z.string().openapi({ example: 'Brunch' }),
    description: z.string(),
    recommendedStyles: z.array(z.string()),
    active: z.boolean(),
  })
  .openapi('Occasion');

// Garments

export const garmentSortSchema = z.enum(['price_asc', 'price_desc', 'name', 'newest']);

export const garmentListQuerySchema = paginationQuerySchema
  .extend({
    q: searchSchema.openapi({ description: 'Busca en el nombre y la descripción.' }),
    storeId: uuidSchema.optional(),
    category: categorySchema.optional(),
    style: slugSchema.optional(),
    occasion: slugSchema.optional().openapi({ description: 'Código de ocasión, por ejemplo `brunch`.' }),
    color: slugSchema.optional(),
    size: sizeSchema.optional(),
    minPriceCop: z.coerce.number().int().min(0).optional(),
    maxPriceCop: z.coerce.number().int().min(0).optional(),
    sort: garmentSortSchema.default('name'),
    includeInactive: queryBoolean.openapi({ description: 'Solo administradores.' }),
  })
  .refine(
    (query) =>
      query.minPriceCop === undefined || query.maxPriceCop === undefined || query.minPriceCop <= query.maxPriceCop,
    { message: 'minPriceCop no puede ser mayor que maxPriceCop.', path: ['minPriceCop'] },
  );

export const createGarmentBodySchema = z
  .object({
    storeId: uuidSchema,
    name: z.string().trim().min(2).max(80).openapi({ example: 'Blazer crema' }),
    description: z.string().trim().max(500).default(''),
    category: categorySchema,
    priceCop: priceCopSchema,
    style: slugSchema.openapi({ example: 'elegant' }),
    color: slugSchema.openapi({ example: 'crema' }),
    sizes: z.array(sizeSchema).max(15).default([]).openapi({ example: ['S', 'M', 'L'] }),
    occasionCodes: z.array(slugSchema).min(1).max(10).openapi({ example: ['office', 'date'] }),
    active: z.boolean().default(true),
  })
  .openapi('CreateGarmentRequest');

export const updateGarmentBodySchema = z
  .object({
    storeId: uuidSchema.optional(),
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(500).optional(),
    category: categorySchema.optional(),
    priceCop: priceCopSchema.optional(),
    style: slugSchema.optional(),
    color: slugSchema.optional(),
    sizes: z.array(sizeSchema).max(15).optional(),
    occasionCodes: z.array(slugSchema).min(1).max(10).optional(),
    active: z.boolean().optional(),
  })
  .refine(atLeastOneField, atLeastOneFieldMessage)
  .openapi('UpdateGarmentRequest');

export const garmentStoreSchema = z
  .object({
    id: z.uuid(),
    name: z.string().openapi({ example: 'Atelier Norte' }),
    style: z.string(),
    active: z.boolean(),
  })
  .openapi('GarmentStore');

export const garmentSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    description: z.string(),
    category: categorySchema,
    priceCop: z.number().int(),
    currency: z.literal('COP'),
    style: z.string(),
    color: z.string(),
    sizes: z.array(z.string()),
    occasions: z.array(z.string()).openapi({ example: ['office', 'date'] }),
    active: z.boolean(),
    store: garmentStoreSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Garment');

export const garmentPageSchema = z
  .object({ data: z.array(garmentSchema), meta: pageMetaSchema })
  .openapi('GarmentPage');

export type StoreListQuery = z.infer<typeof storeListQuerySchema>;
export type CreateStoreBody = z.infer<typeof createStoreBodySchema>;
export type UpdateStoreBody = z.infer<typeof updateStoreBodySchema>;
export type StoreResponse = z.infer<typeof storeSchema>;
export type CreateOccasionBody = z.infer<typeof createOccasionBodySchema>;
export type UpdateOccasionBody = z.infer<typeof updateOccasionBodySchema>;
export type OccasionResponse = z.infer<typeof occasionSchema>;
export type GarmentListQuery = z.infer<typeof garmentListQuerySchema>;
export type CreateGarmentBody = z.infer<typeof createGarmentBodySchema>;
export type UpdateGarmentBody = z.infer<typeof updateGarmentBodySchema>;
export type GarmentResponse = z.infer<typeof garmentSchema>;
