/**
 * Shared pagination helper for tools that return unbounded lists.
 *
 * Every paginated tool exposes a uniform contract:
 *   input:  { limit?: number (1..1000, default 100), offset?: number (>=0, default 0) }
 *   output: { total, limit, offset, hasMore, nextOffset }
 *
 * `total` is the count *before* pagination; the tool's array field holds
 * the sliced page. Past-end offsets return an empty slice, never an error.
 * When `limit` exceeds MAX_PAGE_LIMIT it's clamped with a note so LLM
 * consumers can see why they got fewer items than asked.
 */

import { z } from 'zod';

export const DEFAULT_PAGE_LIMIT = 100;
export const MAX_PAGE_LIMIT = 1000;

export interface PageInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
}

export interface PagedResult<T> {
  items: T[];
  page: PageInfo;
  /** Present only when the caller asked for more than MAX_PAGE_LIMIT. */
  note?: string;
}

export function paginate<T>(
  items: T[],
  limit: number = DEFAULT_PAGE_LIMIT,
  offset: number = 0
): PagedResult<T> {
  const total = items.length;
  const requestedLimit = limit;
  const clampedLimit = Math.min(requestedLimit, MAX_PAGE_LIMIT);
  const clampedOffset = Math.min(offset, total);

  const slice = items.slice(clampedOffset, clampedOffset + clampedLimit);
  const nextOffsetCandidate = clampedOffset + slice.length;
  const hasMore = nextOffsetCandidate < total;

  const result: PagedResult<T> = {
    items: slice,
    page: {
      total,
      limit: clampedLimit,
      offset: clampedOffset,
      hasMore,
      nextOffset: hasMore ? nextOffsetCandidate : null,
    },
  };

  if (requestedLimit > MAX_PAGE_LIMIT) {
    result.note = `limit ${requestedLimit} exceeds max ${MAX_PAGE_LIMIT}; clamped to ${MAX_PAGE_LIMIT}.`;
  }

  return result;
}

/** Zod fragment to merge into a tool's args schema. */
export const paginationArgsSchema = z.object({
  limit: z
    .number()
    .int()
    .positive({ message: 'limit must be > 0' })
    .optional(),
  offset: z
    .number()
    .int()
    .nonnegative({ message: 'offset must be >= 0' })
    .optional(),
});

export type PaginationArgs = z.infer<typeof paginationArgsSchema>;

/** JSON Schema fragment for the MCP tool inputSchema. Spread into properties. */
export function paginationJsonSchema() {
  return {
    limit: {
      type: 'number',
      minimum: 1,
      maximum: MAX_PAGE_LIMIT,
      default: DEFAULT_PAGE_LIMIT,
      description: `Maximum items to return (1..${MAX_PAGE_LIMIT}, default ${DEFAULT_PAGE_LIMIT}). Values above ${MAX_PAGE_LIMIT} are clamped.`,
    },
    offset: {
      type: 'number',
      minimum: 0,
      default: 0,
      description: 'Index of the first item to return (default 0). Use `nextOffset` from the previous response to fetch the next page.',
    },
  } as const;
}
