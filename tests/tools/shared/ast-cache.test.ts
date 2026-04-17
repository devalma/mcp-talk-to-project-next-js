import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  clearAstCache,
  getAstCacheStats,
  parseFileCached,
} from '../../../src/tools/shared/ast-cache.js';

let tmp: string;

beforeEach(() => {
  clearAstCache();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-cache-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function writeFile(rel: string, content: string): string {
  const abs = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

describe('ast-cache', () => {
  it('parses a file and caches the result by reference on second call', () => {
    const file = writeFile('a.ts', 'export const x = 1;');
    const first = parseFileCached(file);
    const second = parseFileCached(file);
    expect(first).not.toBeNull();
    expect(second).toBe(first);
    const stats = getAstCacheStats();
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(1);
  });

  it('invalidates and re-parses when mtime changes', () => {
    const file = writeFile('a.ts', 'export const x = 1;');
    const first = parseFileCached(file);
    fs.writeFileSync(file, 'export const y = 2;');
    const future = (Date.now() + 5000) / 1000;
    fs.utimesSync(file, future, future);
    const second = parseFileCached(file);
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
    expect(second!.content).toContain('y');
    expect(getAstCacheStats().invalidations).toBe(1);
  });

  it('returns null for missing files and does not cache', () => {
    const missing = path.join(tmp, 'nope.ts');
    expect(parseFileCached(missing)).toBeNull();
    expect(getAstCacheStats().size).toBe(0);
    fs.writeFileSync(missing, 'export const z = 3;');
    const parsed = parseFileCached(missing);
    expect(parsed).not.toBeNull();
    expect(parsed!.content).toContain('z');
  });

  it('caches null for unparseable files so re-asks are cheap', () => {
    const file = writeFile('bad.ts', 'this is not @@@ valid syntax !!!');
    expect(parseFileCached(file)).toBeNull();
    expect(parseFileCached(file)).toBeNull();
    const stats = getAstCacheStats();
    expect(stats.size).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(1);
  });

  it('evicts the oldest entry when the LRU cap is exceeded', () => {
    const cap = 500;
    for (let i = 0; i < cap; i++) {
      writeFile(`f${i}.ts`, `export const v${i} = ${i};`);
    }
    for (let i = 0; i < cap; i++) {
      parseFileCached(path.join(tmp, `f${i}.ts`));
    }
    expect(getAstCacheStats().size).toBe(cap);
    // Touch f0 so it is no longer the LRU candidate.
    parseFileCached(path.join(tmp, 'f1.ts'));
    const overflow = writeFile('overflow.ts', 'export const o = 1;');
    parseFileCached(overflow);
    expect(getAstCacheStats().size).toBe(cap);
  });

  it('clearAstCache resets state', () => {
    const file = writeFile('a.ts', 'export const x = 1;');
    parseFileCached(file);
    parseFileCached(file);
    clearAstCache();
    const stats = getAstCacheStats();
    expect(stats).toEqual({ size: 0, hits: 0, misses: 0, invalidations: 0 });
  });
});
