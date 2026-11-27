import { OpenAPIRegistry, OpenApiGeneratorV31, type RouteConfig } from '@asteasolutions/zod-to-openapi';
import { errorResponseSchema, uuidSchema, z } from '../lib/schemas';
import {
  authResponseSchema,
  loginBodySchema,
  registerBodySchema,
  updateMeBodySchema,
  userResponseSchema,
} from '../modules/auth/auth.schemas';
import {
  createGarmentBodySchema,
  createOccasionBodySchema,
  createStoreBodySchema,
  garmentListQuerySchema,
  garmentPageSchema,
  garmentSchema,
  occasionListQuerySchema,
  occasionSchema,
  storeListQuerySchema,
  storePageSchema,
  storeSchema,
  updateGarmentBodySchema,
  updateOccasionBodySchema,
  updateStoreBodySchema,
} from '../modules/catalog/catalog.schemas';
import { lookMatchRequestSchema, lookMatchResponseSchema } from '../modules/look-match/look-match.schemas';
import {
  addItemBodySchema,
  applyRecommendationBodySchema,
  createOutfitBodySchema,
  finalizeBodySchema,
  outfitItemsResultSchema,
  outfitListQuerySchema,
  outfitPageSchema,
  outfitSchema,
  updateOutfitBodySchema,
} from '../modules/outfits/outfit.schemas';

const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

const json = <T extends z.ZodType>(schema: T) => ({ content: { 'application/json': { schema } } });
const ok = <T extends z.ZodType>(description: string, schema: T) => ({ description, ...json(schema) });
const error = (description: string) => ({ description, ...json(errorResponseSchema) });

const common = {
  400: error('Solicitud inválida o regla de negocio incumplida.'),
  429: error('Demasiadas solicitudes.'),
  500: error('Error no controlado del servidor.'),
};
const authErrors = { 401: error('Falta autenticación o el token no es válido.') };
const adminErrors = { ...authErrors, 403: error('El rol no permite la acción.') };
const ownerErrors = {
  ...authErrors,
  403: error('El outfit pertenece a otra persona.'),
  404: error('Outfit o prenda no encontrada.'),
};
const secured: Record<string, string[]>[] = [{ bearerAuth: [] }];
const optionalSecurity: Record<string, string[]>[] = [{}, { bearerAuth: [] }];

const storeIdParams = z.object({ storeId: uuidSchema });
const garmentIdParams = z.object({ garmentId: uuidSchema });
const occasionIdParams = z.object({ occasionId: uuidSchema });
const outfitIdParams = z.object({ outfitId: uuidSchema });
const outfitItemParams = z.object({ outfitId: uuidSchema, garmentId: uuidSchema });

const routes: RouteConfig[] = [
  // Auth
  {
    method: 'post',
    path: '/auth/register',
    tags: ['Autenticación'],
    summary: 'Crea una cuenta',
    request: { body: json(registerBodySchema) },
    responses: { 201: ok('Cuenta creada.', authResponseSchema), 409: error('El correo ya está registrado.'), ...common },
  },
  {
    method: 'post',
    path: '/auth/login',
    tags: ['Autenticación'],
    summary: 'Inicia sesión y devuelve un JWT',
    request: { body: json(loginBodySchema) },
    responses: { 200: ok('Sesión iniciada.', authResponseSchema), 401: error('Credenciales incorrectas.'), ...common },
  },
  {
    method: 'get',
    path: '/auth/me',
    tags: ['Autenticación'],
    summary: 'Devuelve el usuario actual',
    security: secured,
    responses: { 200: ok('Usuario actual.', userResponseSchema), ...authErrors },
  },
  {
    method: 'patch',
    path: '/auth/me',
    tags: ['Autenticación'],
    summary: 'Actualiza nombre y preferencias de estilo y talla',
    description: 'Look Match usa estas preferencias cuando la solicitud no las incluye.',
    security: secured,
    request: { body: json(updateMeBodySchema) },
    responses: { 200: ok('Usuario actualizado.', userResponseSchema), ...authErrors, ...common },
  },

  // Stores
  {
    method: 'get',
    path: '/stores',
    tags: ['Tiendas'],
    summary: 'Lista tiendas',
    security: optionalSecurity,
    request: { query: storeListQuerySchema },
    responses: { 200: ok('Página de tiendas.', storePageSchema), ...common },
  },
  {
    method: 'get',
    path: '/stores/{storeId}',
    tags: ['Tiendas'],
    summary: 'Consulta una tienda',
    security: optionalSecurity,
    request: { params: storeIdParams },
    responses: { 200: ok('Tienda.', storeSchema), 404: error('Tienda no encontrada.'), ...common },
  },
  {
    method: 'post',
    path: '/stores',
    tags: ['Tiendas'],
    summary: 'Crea una tienda (administrador)',
    security: secured,
    request: { body: json(createStoreBodySchema) },
    responses: { 201: ok('Tienda creada.', storeSchema), 409: error('Nombre duplicado.'), ...adminErrors, ...common },
  },
  {
    method: 'patch',
    path: '/stores/{storeId}',
    tags: ['Tiendas'],
    summary: 'Edita o desactiva una tienda (administrador)',
    security: secured,
    request: { params: storeIdParams, body: json(updateStoreBodySchema) },
    responses: {
      200: ok('Tienda actualizada.', storeSchema),
      404: error('Tienda no encontrada.'),
      ...adminErrors,
      ...common,
    },
  },

  // Occasions
  {
    method: 'get',
    path: '/occasions',
    tags: ['Ocasiones'],
    summary: 'Lista ocasiones disponibles',
    security: optionalSecurity,
    request: { query: occasionListQuerySchema },
    responses: { 200: ok('Ocasiones.', z.object({ data: z.array(occasionSchema) })), ...common },
  },
  {
    method: 'post',
    path: '/occasions',
    tags: ['Ocasiones'],
    summary: 'Crea una ocasión (administrador)',
    security: secured,
    request: { body: json(createOccasionBodySchema) },
    responses: { 201: ok('Ocasión creada.', occasionSchema), 409: error('Código duplicado.'), ...adminErrors, ...common },
  },
  {
    method: 'patch',
    path: '/occasions/{occasionId}',
    tags: ['Ocasiones'],
    summary: 'Edita o desactiva una ocasión (administrador)',
    security: secured,
    request: { params: occasionIdParams, body: json(updateOccasionBodySchema) },
    responses: {
      200: ok('Ocasión actualizada.', occasionSchema),
      404: error('Ocasión no encontrada.'),
      ...adminErrors,
      ...common,
    },
  },

  // Garments
  {
    method: 'get',
    path: '/garments',
    tags: ['Prendas'],
    summary: 'Lista prendas con filtros, búsqueda y paginación',
    security: optionalSecurity,
    request: { query: garmentListQuerySchema },
    responses: { 200: ok('Página de prendas.', garmentPageSchema), ...common },
  },
  {
    method: 'get',
    path: '/garments/{garmentId}',
    tags: ['Prendas'],
    summary: 'Consulta una prenda',
    security: optionalSecurity,
    request: { params: garmentIdParams },
    responses: { 200: ok('Prenda.', garmentSchema), 404: error('Prenda no encontrada.'), ...common },
  },
  {
    method: 'post',
    path: '/garments',
    tags: ['Prendas'],
    summary: 'Crea una prenda (administrador)',
    security: secured,
    request: { body: json(createGarmentBodySchema) },
    responses: { 201: ok('Prenda creada.', garmentSchema), ...adminErrors, ...common },
  },
  {
    method: 'patch',
    path: '/garments/{garmentId}',
    tags: ['Prendas'],
    summary: 'Edita una prenda (administrador)',
    security: secured,
    request: { params: garmentIdParams, body: json(updateGarmentBodySchema) },
    responses: {
      200: ok('Prenda actualizada.', garmentSchema),
      404: error('Prenda no encontrada.'),
      ...adminErrors,
      ...common,
    },
  },
  {
    method: 'delete',
    path: '/garments/{garmentId}',
    tags: ['Prendas'],
    summary: 'Desactiva una prenda (administrador)',
    description: 'La prenda no se borra porque los outfits guardados la siguen referenciando.',
    security: secured,
    request: { params: garmentIdParams },
    responses: { 204: { description: 'Prenda desactivada.' }, 404: error('Prenda no encontrada.'), ...adminErrors },
  },

  // Outfits
  {
    method: 'post',
    path: '/outfits',
    tags: ['Outfits y look book'],
    summary: 'Crea un outfit vacío',
    security: secured,
    request: { body: json(createOutfitBodySchema) },
    responses: { 201: ok('Outfit creado.', outfitSchema), ...authErrors, ...common },
  },
  {
    method: 'get',
    path: '/outfits',
    tags: ['Outfits y look book'],
    summary: 'Lista los outfits del usuario (look book con status=saved)',
    security: secured,
    request: { query: outfitListQuerySchema },
    responses: { 200: ok('Página de outfits.', outfitPageSchema), ...authErrors, ...common },
  },
  {
    method: 'get',
    path: '/outfits/{outfitId}',
    tags: ['Outfits y look book'],
    summary: 'Consulta el detalle y el total de un outfit',
    security: secured,
    request: { params: outfitIdParams },
    responses: { 200: ok('Outfit.', outfitSchema), ...ownerErrors },
  },
  {
    method: 'patch',
    path: '/outfits/{outfitId}',
    tags: ['Outfits y look book'],
    summary: 'Cambia nombre, ocasión o presupuesto',
    description: 'Cambiar la ocasión o el presupuesto devuelve el outfit a borrador para validarlo de nuevo.',
    security: secured,
    request: { params: outfitIdParams, body: json(updateOutfitBodySchema) },
    responses: { 200: ok('Outfit actualizado.', outfitSchema), ...ownerErrors, ...common },
  },
  {
    method: 'delete',
    path: '/outfits/{outfitId}',
    tags: ['Outfits y look book'],
    summary: 'Elimina un outfit',
    security: secured,
    request: { params: outfitIdParams },
    responses: { 204: { description: 'Outfit eliminado.' }, ...ownerErrors },
  },
  {
    method: 'post',
    path: '/outfits/{outfitId}/items',
    tags: ['Outfits y look book'],
    summary: 'Agrega una prenda y recalcula el presupuesto',
    security: secured,
    request: { params: outfitIdParams, body: json(addItemBodySchema) },
    responses: {
      200: ok('Prenda agregada.', outfitItemsResultSchema),
      409: error('La prenda ya está en el outfit (GARMENT_ALREADY_ADDED).'),
      ...ownerErrors,
      ...common,
    },
  },
  {
    method: 'delete',
    path: '/outfits/{outfitId}/items/{garmentId}',
    tags: ['Outfits y look book'],
    summary: 'Retira una prenda y recalcula el presupuesto',
    security: secured,
    request: { params: outfitItemParams },
    responses: { 200: ok('Prenda retirada.', outfitItemsResultSchema), ...ownerErrors },
  },
  {
    method: 'post',
    path: '/outfits/{outfitId}/finalize',
    tags: ['Outfits y look book'],
    summary: 'Valida el outfit y lo guarda en el look book',
    description: 'Falla con OUTFIT_INCOMPLETE, BUDGET_EXCEEDED o GARMENT_INACTIVE si no cumple las reglas.',
    security: secured,
    request: { params: outfitIdParams, body: { ...json(finalizeBodySchema), required: false } },
    responses: { 200: ok('Outfit guardado.', outfitSchema), ...ownerErrors, ...common },
  },
  {
    method: 'post',
    path: '/outfits/{outfitId}/apply-recommendation',
    tags: ['Look Match'],
    summary: 'Copia una propuesta de Look Match en un outfit existente',
    description: 'Envía el arreglo `garmentIds` de la propuesta elegida.',
    security: secured,
    request: { params: outfitIdParams, body: json(applyRecommendationBodySchema) },
    responses: { 200: ok('Outfit actualizado.', outfitSchema), ...ownerErrors, ...common },
  },

  // Look Match
  {
    method: 'post',
    path: '/recommendations/look-match',
    tags: ['Look Match'],
    summary: 'Genera hasta tres propuestas explicables',
    description:
      'Devuelve las alternativas `balanced`, `budget` y `statement`. Puntúa ocasión (40%), estilo (30%), presupuesto (20%) y variedad de tiendas (10%).',
    security: optionalSecurity,
    request: { body: json(lookMatchRequestSchema) },
    responses: {
      200: ok('Propuestas.', lookMatchResponseSchema),
      422: error('No hay combinación posible (NO_MATCH_FOUND).'),
      ...common,
    },
  },
];

for (const route of routes) registry.registerPath(route);

export function buildOpenApiDocument() {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'EasyLook API',
      version: '1.0.0',
      description:
        'API REST para descubrir prendas de tiendas simuladas, armar outfits por ocasión con presupuesto visible y pedir recomendaciones explicables con Look Match. El catálogo es ficticio: no hay pagos, envíos ni inventario real.',
    },
    servers: [{ url: '/api/v1' }],
    tags: [
      { name: 'Autenticación' },
      { name: 'Tiendas' },
      { name: 'Ocasiones' },
      { name: 'Prendas' },
      { name: 'Outfits y look book' },
      { name: 'Look Match' },
    ],
  });
}
