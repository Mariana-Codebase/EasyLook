import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { GARMENT_CATEGORIES } from '../db/schema';

extendZodWithOpenApi(z);

export { z };

export const uuidSchema = z.uuid({ message: 'Debe ser un UUID válido.' });

/** Lowercase slug used for styles, colors and occasion codes, e.g. `elegant`, `azul-marino`. */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Usa minúsculas, números y guiones.');

export const sizeSchema = z.string().trim().toUpperCase().min(1).max(10);

export const categorySchema = z.enum(GARMENT_CATEGORIES).openapi({ example: 'top' });

export const priceCopSchema = z
  .number()
  .int('El precio se expresa en pesos enteros, sin decimales.')
  .positive()
  .max(100_000_000)
  .openapi({ example: 149900 });

export const budgetCopSchema = z
  .number()
  .int('El presupuesto se expresa en pesos enteros, sin decimales.')
  .min(0)
  .max(100_000_000)
  .openapi({ example: 350000 });

export const currencySchema = z.literal('COP').openapi({ example: 'COP' });

/** Accepts `?colors=a,b` and repeated query keys, returning a clean array. */
export function csvArray<T extends z.ZodType>(item: T) {
  return z.preprocess((value) => {
    if (value === undefined || value === '') return undefined;
    const list = Array.isArray(value) ? value : [value];
    return list.flatMap((entry) => String(entry).split(',')).map((entry) => entry.trim()).filter(Boolean);
  }, z.array(item).optional());
}

export const queryBoolean = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

export function idParamSchema<K extends string>(name: K) {
  return z.object({ [name]: uuidSchema } as Record<K, typeof uuidSchema>);
}

export const errorResponseSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: 'BUDGET_EXCEEDED' }),
      message: z.string().openapi({ example: 'El outfit supera el presupuesto definido.' }),
      details: z.record(z.string(), z.unknown()).optional(),
    }),
  })
  .openapi('Error');

export const pageMetaSchema = z
  .object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })
  .openapi('PageMeta');
