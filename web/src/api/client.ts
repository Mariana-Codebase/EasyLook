import createClient, { type Middleware } from 'openapi-fetch'
import type { components, paths } from './schema'

export type Schemas = components['schemas']
export type Garment = Schemas['Garment']
export type Store = Schemas['Store']
export type Occasion = Schemas['Occasion']
export type Outfit = Schemas['Outfit']
export type OutfitSummary = Schemas['OutfitSummary']
export type OutfitItem = Schemas['OutfitItem']
export type OutfitItemsResult = Schemas['OutfitItemsResult']
export type Recommendation = Schemas['Recommendation']
export type LookMatchRequest = Schemas['LookMatchRequest']
export type LookMatchResponse = Schemas['LookMatchResponse']
export type User = Schemas['User']
export type Category = Garment['category']
export type BudgetStatus = Outfit['budgetStatus']

const TOKEN_KEY = 'easylook.token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

/** Error body defined by the API contract: { error: { code, message, details } }. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: Record<string, unknown>

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

const authMiddleware: Middleware = {
  onRequest({ request }) {
    const token = tokenStore.get()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    return request
  },
}

/** Typed client generated from the API's published OpenAPI contract (docs/openapi.json). */
export const api = createClient<paths>({ baseUrl: `${import.meta.env.VITE_API_URL ?? ''}/api/v1` })
api.use(authMiddleware)

type Result<T> = { data?: T; error?: unknown; response: Response }

/** Returns the data of a successful call or throws an ApiError carrying the contract's error code. */
export async function unwrap<T>(call: Promise<Result<T>>): Promise<T> {
  let result: Result<T>
  try {
    result = await call
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'No hay conexión con la API. Revisa que el servidor esté encendido.')
  }
  const { data, error, response } = result
  if (response.ok) return data as T
  const body = (error as { error?: { code?: string; message?: string; details?: Record<string, unknown> } })?.error
  if (response.status === 401) tokenStore.clear()
  throw new ApiError(
    response.status,
    body?.code ?? 'HTTP_ERROR',
    body?.message ?? `La API respondió ${response.status}.`,
    body?.details,
  )
}
