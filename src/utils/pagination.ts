/**
 * Pagination Utilities for ONE Engine
 */

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Default pagination values
 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Parse pagination params from query
 */
export function parsePaginationParams(query: {
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: string;
}): PaginationParams {
  const page = Math.max(1, Number(query.page) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  return {
    page,
    limit,
    sortBy: query.sortBy,
    sortOrder,
  };
}

/**
 * Calculate pagination offset
 */
export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Calculate total pages
 */
export function calculateTotalPages(total: number, limit: number): number {
  return Math.ceil(total / limit);
}

/**
 * Create pagination result
 */
export function createPaginationResult<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginationResult<T> {
  const totalPages = calculateTotalPages(total, params.limit);

  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1,
    },
  };
}

/**
 * Apply pagination to array (for in-memory pagination)
 */
export function paginateArray<T>(
  array: T[],
  params: PaginationParams
): PaginationResult<T> {
  const offset = calculateOffset(params.page, params.limit);
  const data = array.slice(offset, offset + params.limit);

  return createPaginationResult(data, array.length, params);
}

/**
 * Sort array by key
 */
export function sortArray<T extends Record<string, unknown>>(
  array: T[],
  sortBy: string,
  sortOrder: 'asc' | 'desc' = 'desc'
): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    const comparison = aVal < bVal ? -1 : 1;
    return sortOrder === 'asc' ? comparison : -comparison;
  });
}

/**
 * Build Supabase pagination query
 */
export function buildSupabasePagination(
  query: any,
  params: PaginationParams
): any {
  const offset = calculateOffset(params.page, params.limit);

  let q = query.range(offset, offset + params.limit - 1);

  if (params.sortBy) {
    q = q.order(params.sortBy, { ascending: params.sortOrder === 'asc' });
  }

  return q;
}

/**
 * Cursor-based pagination params
 */
export interface CursorPaginationParams {
  cursor?: string;
  limit: number;
  direction?: 'forward' | 'backward';
}

/**
 * Cursor-based pagination result
 */
export interface CursorPaginationResult<T> {
  data: T[];
  cursors: {
    next?: string;
    prev?: string;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Create cursor from item (typically using timestamp + id)
 */
export function createCursor(timestamp: string | Date, id: string): string {
  const ts = new Date(timestamp).getTime();
  return Buffer.from(`${ts}:${id}`).toString('base64');
}

/**
 * Parse cursor
 */
export function parseCursor(cursor: string): { timestamp: number; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString();
    const [ts, id] = decoded.split(':');
    return { timestamp: parseInt(ts, 10), id };
  } catch {
    return null;
  }
}

/**
 * Create cursor pagination result
 */
export function createCursorPaginationResult<T extends { id: string; created_at?: string; createdAt?: string }>(
  data: T[],
  params: CursorPaginationParams,
  hasMore: boolean
): CursorPaginationResult<T> {
  const firstItem = data[0];
  const lastItem = data[data.length - 1];

  return {
    data,
    cursors: {
      next: lastItem ? createCursor(lastItem.created_at || lastItem.createdAt || new Date().toISOString(), lastItem.id) : undefined,
      prev: firstItem ? createCursor(firstItem.created_at || firstItem.createdAt || new Date().toISOString(), firstItem.id) : undefined,
      hasNext: hasMore,
      hasPrev: !!params.cursor,
    },
  };
}
