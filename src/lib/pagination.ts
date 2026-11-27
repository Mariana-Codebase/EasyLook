import { z } from './schemas';

export const MAX_PAGE_LIMIT = 100;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Page<T> {
  data: T[];
  meta: PageMeta;
}

export function offsetOf({ page, limit }: PaginationQuery): number {
  return (page - 1) * limit;
}

export function toPage<T>(data: T[], total: number, { page, limit }: PaginationQuery): Page<T> {
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
