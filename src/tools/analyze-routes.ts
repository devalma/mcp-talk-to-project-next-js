/**
 * Analyze Routes Tool
 *
 * LLM-friendly routing graph for a Next.js project.
 *
 * For each route (App Router page, Pages Router page, or Route Handler):
 *   - URL path (with App Router group/parallel/intercepting segments stripped)
 *   - File path
 *   - Router type (app / pages)
 *   - Rendering ('server' / 'client' for App Router pages)
 *   - Data fetching (async-rsc / gssp / gsp / route-handler / none)
 *   - Dynamic segments
 *   - Layout chain (App Router only)
 *   - HTTP methods (route handlers only)
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import type { ToolDefinition, ToolContext } from './types.js';
import { createTextResponse, createErrorResponse } from './types.js';

const ArgsSchema = z.object({
  path: z.string().optional(),
  format: z.enum(['text', 'markdown', 'json']).default('json').optional(),
});

type Args = z.infer<typeof ArgsSchema>;

export type RouterType = 'app' | 'pages';
export type RouteKind = 'page' | 'route-handler' | 'api-route';
export type Rendering = 'server' | 'client' | null;
export type DataFetching =
  | 'async-rsc'
  | 'gssp'
  | 'gsp'
  | 'isr'
  | 'route-handler'
  | 'none';

export interface Route {
  path: string;
  file: string;
  routerType: RouterType;
  kind: RouteKind;
  dynamicSegments: string[];
  rendering: Rendering;
  dataFetching: DataFetching;
  layoutChain?: string[];
  methods?: string[];
}

export const analyzeRoutesTool: ToolDefinition = {
  definition: {
    name: 'analyze_routes',
    description:
      'Routing graph for the Next.js project: URL → file, with server/client rendering, data-fetching mode, dynamic segments, layout chain (App Router), and HTTP methods (route handlers). Pass `path` to filter (e.g. "/settings" or "/settings/**").',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'Filter routes by URL path. Exact match or glob-style prefix ending in /**',
        },
        format: {
          type: 'string',
          enum: ['text', 'markdown', 'json'],
          description: 'Output format',
          default: 'json',
        },
      },
    },
  } as Tool,

  handler: async (args: Args, context: ToolContext) => {
    try {
      const { path: pathFilter, format = 'json' } = ArgsSchema.parse(args);
      const routes = await analyzeRoutes(context.resolvedProjectPath);
      const filtered = pathFilter ? routes.filter(matchesPathFilter(pathFilter)) : routes;

      if (format === 'json') {
        return createTextResponse(
          JSON.stringify({ count: filtered.length, routes: filtered }, null, 2)
        );
      }
      return createTextResponse(formatRoutes(filtered, format));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(
          `Invalid arguments: ${error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
        );
      }
      const message = error instanceof Error ? error.message : String(error);
      return createErrorResponse(`Route analysis failed: ${message}`);
    }
  },
};

// ---------- core ----------

export async function analyzeRoutes(projectPath: string): Promise<Route[]> {
  const routes: Route[] = [];

  const appDir = firstExistingDir(projectPath, ['src/app', 'app']);
  const pagesDir = firstExistingDir(projectPath, ['src/pages', 'pages']);

  if (appDir) routes.push(...(await analyzeAppRouter(projectPath, appDir)));
  if (pagesDir) routes.push(...(await analyzePagesRouter(projectPath, pagesDir)));

  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

// ---------- App Router ----------

async function analyzeAppRouter(projectPath: string, appDir: string): Promise<Route[]> {
  const absAppDir = path.join(projectPath, appDir);
  const pattern = '**/{page,route}.{ts,tsx,js,jsx}';
  const files = await glob(pattern, { cwd: absAppDir, nodir: true });

  const routes: Route[] = [];
  for (const rel of files) {
    const absFile = path.join(absAppDir, rel);
    const relToProject = path.join(appDir, rel).replace(/\\/g, '/');
    const baseName = path.basename(rel).replace(/\.[jt]sx?$/, '');

    if (skipAppSegment(rel)) continue; // intercepting routes

    const url = appRouterPath(rel);
    const dynamicSegments = extractDynamicSegments(rel);
    const content = readFileSafe(absFile);

    if (baseName === 'page') {
      const isClient = hasUseClient(content);
      const isAsync = hasAsyncDefaultExport(content);
      const layoutChain = findLayoutChain(absAppDir, appDir, rel);

      routes.push({
        path: url,
        file: relToProject,
        routerType: 'app',
        kind: 'page',
        dynamicSegments,
        rendering: isClient ? 'client' : 'server',
        dataFetching: isClient ? 'none' : isAsync ? 'async-rsc' : 'none',
        layoutChain,
      });
    } else if (baseName === 'route') {
      const methods = extractRouteHandlerMethods(content);
      routes.push({
        path: url,
        file: relToProject,
        routerType: 'app',
        kind: 'route-handler',
        dynamicSegments,
        rendering: null,
        dataFetching: 'route-handler',
        methods,
      });
    }
  }

  return routes;
}

/**
 * Convert an App Router file path to its URL.
 * - `(group)` and `@slot` segments are URL-invisible
 * - `page.tsx` / `route.ts` file is dropped
 * - `[id]`, `[...slug]`, `[[...slug]]` preserved verbatim (Next.js convention)
 */
function appRouterPath(relFile: string): string {
  const parts = relFile.split('/').slice(0, -1); // drop the filename
  const visible = parts.filter((p) => !isUrlInvisibleSegment(p));
  return '/' + visible.join('/');
}

function isUrlInvisibleSegment(segment: string): boolean {
  // Route groups: (marketing)
  if (/^\(.+\)$/.test(segment) && !segment.startsWith('(.)') && !segment.startsWith('(..)')) {
    return true;
  }
  // Parallel route slots: @modal
  if (segment.startsWith('@')) return true;
  return false;
}

function skipAppSegment(relFile: string): boolean {
  // Intercepting routes like (.)photo/[id] or (..)photo/[id] — these don't
  // define their own URL; they intercept another. Skip from the main graph.
  return relFile.split('/').some((s) => /^\(\.\.?\)/.test(s));
}

function findLayoutChain(absAppDir: string, appDir: string, relFile: string): string[] {
  const segments = relFile.split('/').slice(0, -1); // drop the filename
  const chain: string[] = [];

  // Walk from root → parent of file, collecting any layout.* that exists.
  for (let i = 0; i <= segments.length; i++) {
    const dirRel = segments.slice(0, i).join('/');
    const dirAbs = path.join(absAppDir, dirRel);
    for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
      const layoutAbs = path.join(dirAbs, 'layout' + ext);
      if (fs.existsSync(layoutAbs)) {
        chain.push(path.join(appDir, dirRel, 'layout' + ext).replace(/\\/g, '/'));
        break;
      }
    }
  }

  return chain;
}

// ---------- Pages Router ----------

async function analyzePagesRouter(
  projectPath: string,
  pagesDir: string
): Promise<Route[]> {
  const absPagesDir = path.join(projectPath, pagesDir);
  const pattern = '**/*.{ts,tsx,js,jsx}';
  const files = await glob(pattern, {
    cwd: absPagesDir,
    nodir: true,
    ignore: ['**/_*.{ts,tsx,js,jsx}', '**/*.d.ts', '**/*.test.*', '**/*.spec.*'],
  });

  const routes: Route[] = [];
  for (const rel of files) {
    const absFile = path.join(absPagesDir, rel);
    const relToProject = path.join(pagesDir, rel).replace(/\\/g, '/');
    const url = pagesRouterPath(rel);
    const dynamicSegments = extractDynamicSegments(rel);
    const isApi = rel.startsWith('api/') || rel.startsWith('api\\');

    if (isApi) {
      routes.push({
        path: url,
        file: relToProject,
        routerType: 'pages',
        kind: 'api-route',
        dynamicSegments,
        rendering: null,
        dataFetching: 'route-handler',
      });
      continue;
    }

    const content = readFileSafe(absFile);
    const dataFetching = detectPagesDataFetching(content);

    routes.push({
      path: url,
      file: relToProject,
      routerType: 'pages',
      kind: 'page',
      dynamicSegments,
      rendering: null, // Pages Router doesn't have server/client split
      dataFetching,
    });
  }

  return routes;
}

function pagesRouterPath(relFile: string): string {
  let p = '/' + relFile.replace(/\.[jt]sx?$/, '').replace(/\\/g, '/');
  // index → directory URL
  p = p.replace(/\/index$/, '') || '/';
  return p === '' ? '/' : p;
}

function detectPagesDataFetching(content: string): DataFetching {
  if (/\bexport\s+(async\s+)?function\s+getServerSideProps\b/.test(content)) return 'gssp';
  if (/\bexport\s+const\s+getServerSideProps\b/.test(content)) return 'gssp';
  if (/\bexport\s+(async\s+)?function\s+getStaticProps\b/.test(content)) return 'gsp';
  if (/\bexport\s+const\s+getStaticProps\b/.test(content)) return 'gsp';
  return 'none';
}

// ---------- shared file inspection (regex-based, fast) ----------

function hasUseClient(content: string): boolean {
  // 'use client' must be the first statement. Tolerate any number of leading
  // line/block comments and whitespace.
  const stripped = content.replace(/^(?:\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/))+/, '').trimStart();
  return /^(['"])use client\1/.test(stripped);
}

function hasAsyncDefaultExport(content: string): boolean {
  // export default async function …
  if (/\bexport\s+default\s+async\s+function\b/.test(content)) return true;
  // export default async () => …
  if (/\bexport\s+default\s+async\s*(\([^)]*\)|\w+)\s*=>/.test(content)) return true;
  // const Foo = async …; export default Foo
  // Heuristic: look for `async function ComponentName` whose name appears in export default
  const asyncFnMatch = /\basync\s+function\s+([A-Z]\w*)/.exec(content);
  if (asyncFnMatch) {
    const name = asyncFnMatch[1];
    if (new RegExp(`\\bexport\\s+default\\s+${name}\\b`).test(content)) return true;
  }
  return false;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function extractRouteHandlerMethods(content: string): string[] {
  const found: string[] = [];
  for (const m of HTTP_METHODS) {
    const re = new RegExp(
      `\\bexport\\s+(?:async\\s+)?(?:function\\s+${m}\\b|const\\s+${m}\\s*=|\\{[^}]*\\b${m}\\b[^}]*\\})`
    );
    if (re.test(content)) found.push(m);
  }
  return found;
}

const OPT_CATCH_ALL_RE = /^\[\[(\.\.\.[^\]]+)\]\]$/;
const DYNAMIC_SEG_RE = /^\[([^\]]+)\]$/;

function extractDynamicSegments(relFile: string): string[] {
  const segs: string[] = [];
  for (const part of relFile.split('/')) {
    // Optional catch-all [[...name]] → keep inner [...name]
    const optCatchAll = OPT_CATCH_ALL_RE.exec(part);
    if (optCatchAll) {
      segs.push(`[${optCatchAll[1]}]`);
      continue;
    }
    // Normal [name] or catch-all [...name]
    const m = DYNAMIC_SEG_RE.exec(part);
    if (m) segs.push(m[1]);
  }
  return segs;
}

// ---------- filter + formatting ----------

export function matchesPathFilter(filter: string): (r: Route) => boolean {
  if (filter.endsWith('/**')) {
    const prefix = filter.slice(0, -3) || '/';
    return (r) => r.path === prefix || r.path.startsWith(prefix === '/' ? '/' : prefix + '/');
  }
  return (r) => r.path === filter;
}

function formatRoutes(routes: Route[], format: 'text' | 'markdown'): string {
  if (!routes.length) return 'No routes found.';
  const lines: string[] = [];
  if (format === 'markdown') lines.push(`# Routes (${routes.length})\n`);
  else lines.push(`Routes (${routes.length}):`);
  for (const r of routes) {
    const head = `${r.path}  [${r.routerType}/${r.kind}]`;
    lines.push(format === 'markdown' ? `## ${head}` : head);
    lines.push(`  file: ${r.file}`);
    if (r.dynamicSegments.length) lines.push(`  dynamic: ${r.dynamicSegments.join(', ')}`);
    if (r.rendering) lines.push(`  rendering: ${r.rendering}`);
    if (r.dataFetching !== 'none') lines.push(`  dataFetching: ${r.dataFetching}`);
    if (r.methods?.length) lines.push(`  methods: ${r.methods.join(', ')}`);
    if (r.layoutChain?.length) lines.push(`  layouts: ${r.layoutChain.join(' → ')}`);
    lines.push('');
  }
  return lines.join('\n');
}

// ---------- helpers ----------

function firstExistingDir(projectPath: string, candidates: string[]): string | null {
  for (const c of candidates) {
    const d = path.join(projectPath, c);
    if (fs.existsSync(d) && fs.statSync(d).isDirectory()) return c;
  }
  return null;
}

function readFileSafe(absPath: string): string {
  try {
    return fs.readFileSync(absPath, 'utf-8');
  } catch {
    return '';
  }
}
