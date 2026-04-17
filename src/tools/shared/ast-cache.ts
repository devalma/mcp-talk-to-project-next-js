/**
 * Session-scoped AST cache for the LLM-oriented tools.
 *
 * Five tools (find_symbol, find_references, get_file_exports,
 * get_component_props, get_hook_signature) used to parse files inline
 * with near-identical helpers. Pagination amplified the cost: every page
 * re-walked the project and re-parsed every file. This module unifies on
 * a single parser configured with the superset of plugins those tools
 * needed, and caches by (absFile, mtimeMs).
 *
 * In-memory only — a fresh process is a fresh cache. Persistent caching
 * was deliberately rejected to avoid the invalidation surface across
 * branch switches, package installs, etc. (see docs/1.6-ast-cache.md).
 */

import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import type { File as BabelFile } from '@babel/types';

export interface ParsedSource {
  ast: BabelFile;
  content: string;
  absFile: string;
}

interface CacheEntry {
  mtimeMs: number;
  parsed: ParsedSource | null;
  lastAccessed: number;
}

const MAX_ENTRIES = 500;

const cache = new Map<string, CacheEntry>();
let hits = 0;
let misses = 0;
let invalidations = 0;
let accessTick = 0;

function isTsFile(absFile: string): boolean {
  return absFile.endsWith('.ts') || absFile.endsWith('.tsx');
}

function isJsxFile(absFile: string): boolean {
  return (
    absFile.endsWith('.tsx') || absFile.endsWith('.jsx') || absFile.endsWith('.js')
  );
}

function parseSource(content: string, absFile: string): BabelFile | null {
  const isTs = isTsFile(absFile);
  const isJsx = isJsxFile(absFile);
  try {
    return parse(content, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      plugins: [
        'decorators-legacy',
        'dynamicImport',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'optionalChaining',
        'nullishCoalescingOperator',
        'topLevelAwait',
        ...(isTs ? (['typescript'] as const) : []),
        ...(isJsx ? (['jsx'] as const) : []),
      ] as any,
    }) as unknown as BabelFile;
  } catch {
    return null;
  }
}

function evictOldestIfFull(): void {
  if (cache.size < MAX_ENTRIES) return;
  let oldestKey: string | null = null;
  let oldestTick = Infinity;
  for (const [key, entry] of cache) {
    if (entry.lastAccessed < oldestTick) {
      oldestTick = entry.lastAccessed;
      oldestKey = key;
    }
  }
  if (oldestKey !== null) cache.delete(oldestKey);
}

/**
 * Parse a file and return its AST, or null if the file is missing, empty,
 * or unparseable. Cached by (absFile, mtimeMs). On mtime change the entry
 * is invalidated and re-parsed.
 *
 * Missing files are NOT cached (so a later create-then-call doesn't serve
 * a stale null). Unparseable files ARE cached so syntactically broken
 * files don't re-incur parser cost on every page.
 */
export function parseFileCached(absFile: string): ParsedSource | null {
  const key = path.resolve(absFile);

  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(key).mtimeMs;
  } catch {
    misses += 1;
    return null;
  }

  const existing = cache.get(key);
  if (existing && existing.mtimeMs === mtimeMs) {
    existing.lastAccessed = ++accessTick;
    hits += 1;
    return existing.parsed;
  }

  if (existing) invalidations += 1;
  misses += 1;

  let content: string;
  try {
    content = fs.readFileSync(key, 'utf-8');
  } catch {
    if (existing) cache.delete(key);
    return null;
  }

  const ast = parseSource(content, key);
  const parsed: ParsedSource | null = ast
    ? { ast, content, absFile: key }
    : null;

  if (!existing) evictOldestIfFull();
  cache.set(key, { mtimeMs, parsed, lastAccessed: ++accessTick });
  return parsed;
}

/** Drop all cached entries and reset counters. Test-only. */
export function clearAstCache(): void {
  cache.clear();
  hits = 0;
  misses = 0;
  invalidations = 0;
  accessTick = 0;
}

/** Cache stats for tests + potential future telemetry. */
export function getAstCacheStats(): {
  size: number;
  hits: number;
  misses: number;
  invalidations: number;
} {
  return { size: cache.size, hits, misses, invalidations };
}
