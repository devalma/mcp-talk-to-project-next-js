import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getHookSignature } from '../../src/tools/get-hook-signature.js';
import { clearAstCache } from '../../src/tools/shared/ast-cache.js';

let tmp: string;

function write(rel: string, content = '') {
  const full = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

beforeEach(() => {
  clearAstCache();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-sig-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('getHookSignature', () => {
  it('extracts a simple function hook signature', () => {
    write(
      'src/useAuth.ts',
      `export function useAuth(userId: string, options?: { refetch: boolean }): { token: string } {
  return { token: '' };
}`
    );
    const r = getHookSignature(tmp, 'useAuth', 'src/useAuth.ts');
    expect(r.found).toBe(true);
    expect(r.kind).toBe('function');
    expect(r.parameters).toEqual([
      { name: 'userId', type: 'string', required: true },
      {
        name: 'options',
        type: '{ refetch: boolean }',
        required: false,
      },
    ]);
    expect(r.returnType).toBe('{ token: string }');
  });

  it('extracts an arrow hook signature', () => {
    write(
      'src/useCount.ts',
      `export const useCount = (start: number): number => start;`
    );
    const r = getHookSignature(tmp, 'useCount', 'src/useCount.ts');
    expect(r.kind).toBe('arrow');
    expect(r.parameters).toEqual([
      { name: 'start', type: 'number', required: true },
    ]);
    expect(r.returnType).toBe('number');
  });

  it('returns null return type when inferred', () => {
    write(
      'src/useThing.ts',
      `export function useThing(x: string) { return x; }`
    );
    const r = getHookSignature(tmp, 'useThing', 'src/useThing.ts');
    expect(r.returnType).toBeNull();
  });

  it('marks optional parameters with a default value as not required', () => {
    write(
      'src/useThing.ts',
      `export function useThing(a: number, b: number = 10) { return a + b; }`
    );
    const r = getHookSignature(tmp, 'useThing', 'src/useThing.ts');
    expect(r.parameters[0]).toEqual({ name: 'a', type: 'number', required: true });
    expect(r.parameters[1]).toEqual({ name: 'b', type: 'number', required: false });
  });

  it('handles destructured object param with type', () => {
    write(
      'src/useThing.ts',
      `interface Options { limit: number; page?: number }
export function useThing({ limit, page }: Options) { return limit + (page ?? 0); }`
    );
    const r = getHookSignature(tmp, 'useThing', 'src/useThing.ts');
    expect(r.parameters).toHaveLength(1);
    expect(r.parameters[0]).toMatchObject({
      name: 'options',
      type: 'Options',
      required: true,
      destructured: true,
    });
  });

  it('handles destructured array param', () => {
    write(
      'src/useThing.ts',
      `export function useThing([a, b]: readonly [string, number]) { return a + b; }`
    );
    const r = getHookSignature(tmp, 'useThing', 'src/useThing.ts');
    expect(r.parameters).toHaveLength(1);
    expect(r.parameters[0]).toMatchObject({
      name: 'tuple',
      type: 'readonly [string, number]',
      required: true,
      destructured: true,
    });
  });

  it('handles rest parameters', () => {
    write(
      'src/useThing.ts',
      `export function useThing(first: string, ...rest: number[]) { return rest.length; }`
    );
    const r = getHookSignature(tmp, 'useThing', 'src/useThing.ts');
    expect(r.parameters).toHaveLength(2);
    expect(r.parameters[1]).toEqual({
      name: 'rest',
      type: 'number[]',
      required: false,
      rest: true,
    });
  });

  it('handles export default function useX', () => {
    write(
      'src/useThing.ts',
      `export default function useThing(x: number): string { return String(x); }`
    );
    const r = getHookSignature(tmp, 'useThing', 'src/useThing.ts');
    expect(r.found).toBe(true);
    expect(r.parameters).toEqual([{ name: 'x', type: 'number', required: true }]);
    expect(r.returnType).toBe('string');
  });

  it('handles no-parameter hook', () => {
    write(
      'src/useNow.ts',
      `export function useNow(): number { return Date.now(); }`
    );
    const r = getHookSignature(tmp, 'useNow', 'src/useNow.ts');
    expect(r.parameters).toEqual([]);
    expect(r.returnType).toBe('number');
  });

  it('returns any type for untyped parameters', () => {
    write(
      'src/useLoose.js',
      `export function useLoose(x) { return x; }`
    );
    const r = getHookSignature(tmp, 'useLoose', 'src/useLoose.js');
    expect(r.parameters).toEqual([{ name: 'x', type: 'any', required: true }]);
  });

  it('reports not found when the hook is missing', () => {
    write('src/a.ts', 'export function other() {}');
    const r = getHookSignature(tmp, 'useMissing', 'src/a.ts');
    expect(r.found).toBe(false);
    expect(r.notes[0]).toMatch(/not found/);
  });

  it('throws when file does not exist', () => {
    expect(() => getHookSignature(tmp, 'useX', 'nope.ts')).toThrow(/File not found/);
  });
});
