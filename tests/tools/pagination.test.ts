import { describe, expect, it } from 'vitest';
import {
  paginate,
  paginationArgsSchema,
  paginationJsonSchema,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '../../src/tools/shared/pagination.js';

describe('paginate', () => {
  const five = [1, 2, 3, 4, 5];

  it('returns everything under the default limit', () => {
    const r = paginate(five);
    expect(r.items).toEqual(five);
    expect(r.page).toEqual({
      total: 5,
      limit: DEFAULT_PAGE_LIMIT,
      offset: 0,
      hasMore: false,
      nextOffset: null,
    });
    expect(r.note).toBeUndefined();
  });

  it('slices a middle page', () => {
    const r = paginate(five, 2, 0);
    expect(r.items).toEqual([1, 2]);
    expect(r.page).toMatchObject({ total: 5, hasMore: true, nextOffset: 2 });
  });

  it('returns the last partial page', () => {
    const r = paginate(five, 2, 4);
    expect(r.items).toEqual([5]);
    expect(r.page).toMatchObject({ hasMore: false, nextOffset: null });
  });

  it('returns empty slice for offset past end', () => {
    const r = paginate(five, 10, 10);
    expect(r.items).toEqual([]);
    expect(r.page.total).toBe(5);
    expect(r.page.hasMore).toBe(false);
    expect(r.page.nextOffset).toBeNull();
  });

  it('concatenated pages equal the full list (stable order)', () => {
    const page1 = paginate(five, 2, 0);
    const page2 = paginate(five, 2, 2);
    const page3 = paginate(five, 2, 4);
    expect([...page1.items, ...page2.items, ...page3.items]).toEqual(five);
    expect(page3.page.hasMore).toBe(false);
  });

  it('handles zero-length input', () => {
    const r = paginate([] as number[]);
    expect(r.items).toEqual([]);
    expect(r.page).toMatchObject({ total: 0, hasMore: false, nextOffset: null });
  });

  it('clamps limits above MAX_PAGE_LIMIT and sets a note', () => {
    const big = Array.from({ length: MAX_PAGE_LIMIT + 50 }, (_, i) => i);
    const r = paginate(big, MAX_PAGE_LIMIT + 200, 0);
    expect(r.items).toHaveLength(MAX_PAGE_LIMIT);
    expect(r.page.limit).toBe(MAX_PAGE_LIMIT);
    expect(r.page.hasMore).toBe(true);
    expect(r.page.nextOffset).toBe(MAX_PAGE_LIMIT);
    expect(r.note).toMatch(/clamped/);
  });

  it('reports hasMore correctly at the exact boundary', () => {
    const r = paginate(five, 5, 0);
    expect(r.items).toHaveLength(5);
    expect(r.page.hasMore).toBe(false);
    expect(r.page.nextOffset).toBeNull();
  });
});

describe('paginationArgsSchema', () => {
  it('accepts undefined (both fields optional)', () => {
    expect(paginationArgsSchema.parse({})).toEqual({});
  });

  it('accepts valid values', () => {
    const r = paginationArgsSchema.parse({ limit: 10, offset: 20 });
    expect(r).toEqual({ limit: 10, offset: 20 });
  });

  it('rejects limit = 0', () => {
    expect(() => paginationArgsSchema.parse({ limit: 0 })).toThrow(/> 0/);
  });

  it('rejects negative limit', () => {
    expect(() => paginationArgsSchema.parse({ limit: -5 })).toThrow(/> 0/);
  });

  it('rejects negative offset', () => {
    expect(() => paginationArgsSchema.parse({ offset: -1 })).toThrow(/>= 0/);
  });

  it('rejects non-integer limit', () => {
    expect(() => paginationArgsSchema.parse({ limit: 1.5 })).toThrow();
  });
});

describe('paginationJsonSchema', () => {
  it('exposes the documented shape', () => {
    const s = paginationJsonSchema();
    expect(s.limit).toMatchObject({ type: 'number', minimum: 1, maximum: MAX_PAGE_LIMIT, default: DEFAULT_PAGE_LIMIT });
    expect(s.offset).toMatchObject({ type: 'number', minimum: 0, default: 0 });
  });
});
