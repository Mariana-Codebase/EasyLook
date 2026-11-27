import { sizeSchema, slugSchema, z } from '../../lib/schemas';

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('Correo inválido.'))
  .openapi({ example: 'laura@correo.com' });

const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  // bcrypt only uses the first 72 bytes, so longer inputs would silently be truncated.
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'La contraseña no puede superar 72 bytes.')
  .openapi({ example: 'MiClave2026!' });

export const registerBodySchema = z
  .object({
    name: z.string().trim().min(2).max(80).openapi({ example: 'Laura Gómez' }),
    email: emailSchema,
    password: passwordSchema,
  })
  .openapi('RegisterRequest');

export const loginBodySchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(200).openapi({ example: 'MiClave2026!' }),
  })
  .openapi('LoginRequest');

export const updateMeBodySchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    preferredStyles: z.array(slugSchema).max(10).optional().openapi({ example: ['elegant', 'minimal'] }),
    preferredSizes: z.array(sizeSchema).max(10).optional().openapi({ example: ['S', 'M', '38'] }),
  })
  .refine((value) => Object.keys(value).length > 0, 'Envía al menos un campo para actualizar.')
  .openapi('UpdateMeRequest');

export const userResponseSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
    role: z.enum(['user', 'admin']),
    preferredStyles: z.array(z.string()),
    preferredSizes: z.array(z.string()),
    createdAt: z.string().openapi({ example: '2026-11-26T15:04:05.000Z' }),
  })
  .openapi('User');

export const authResponseSchema = z
  .object({
    token: z.string(),
    tokenType: z.literal('Bearer'),
    expiresIn: z.string().openapi({ example: '1h' }),
    user: userResponseSchema,
  })
  .openapi('AuthResponse');

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type UpdateMeBody = z.infer<typeof updateMeBodySchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
