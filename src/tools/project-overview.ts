/**
 * Project Overview Tool
 *
 * Consolidated project state: fingerprint + route summary + component/hook
 * counts. Overview = breadth; if you only need the stack/structure, call
 * get_project_fingerprint (no AST walking, milliseconds).
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import type { ToolDefinition, ToolContext } from './types.js';
import { createTextResponse, createErrorResponse } from './types.js';
import {
  computeFingerprint,
  type ProjectFingerprint,
} from './project-fingerprint.js';
import { analyzeRoutes, type Route } from './analyze-routes.js';

const ArgsSchema = z.object({
  format: z.enum(['text', 'markdown', 'json']).default('json').optional(),
});

type Args = z.infer<typeof ArgsSchema>;

export interface RouteSummary {
  total: number;
  pages: number;
  routeHandlers: number;
  apiRoutes: number;
  dynamic: number;
  server: number;
  client: number;
}

export interface Counts {
  components: number;
  customHooks: number;
}

export interface ProjectOverview {
  name: string;
  version: string | null;
  fingerprint: ProjectFingerprint;
  routes: RouteSummary;
  counts: Counts;
}

export const projectOverviewTool: ToolDefinition = {
  definition: {
    name: 'get_project_overview',
    description:
      'Consolidated project state: fingerprint (framework/stack/tooling), route summary (counts by kind/rendering/dynamic), and code counts (components, custom hooks). Breadth-oriented — combines fingerprint + routes + plugin analysis. For a cheaper first-call, use get_project_fingerprint.',
    inputSchema: {
      type: 'object',
      properties: {
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
      const { format = 'json' } = ArgsSchema.parse(args);
      const overview = await computeOverview(
        context.resolvedProjectPath,
        context.pluginManager
      );

      if (format === 'json') {
        return createTextResponse(JSON.stringify(overview, null, 2));
      }
      return createTextResponse(formatOverview(overview, format));
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.issues
          .map((i) => i.path.join('.') + ': ' + i.message)
          .join(', ');
        return createErrorResponse('Invalid arguments: ' + details);
      }
      const message = error instanceof Error ? error.message : String(error);
      return createErrorResponse(`Project overview failed: ${message}`);
    }
  },
};

export async function computeOverview(
  projectPath: string,
  pluginManager: any
): Promise<ProjectOverview> {
  const pkg = readPackageJson(projectPath);
  const fingerprint = computeFingerprint(projectPath);

  const [routes, counts] = await Promise.all([
    safeAnalyzeRoutes(projectPath),
    pluginCounts(projectPath, pluginManager),
  ]);

  return {
    name: pkg.name || path.basename(projectPath),
    version: pkg.version ?? null,
    fingerprint,
    routes: summarizeRoutes(routes),
    counts,
  };
}

export function summarizeRoutes(routes: Route[]): RouteSummary {
  let pages = 0;
  let routeHandlers = 0;
  let apiRoutes = 0;
  let dynamic = 0;
  let server = 0;
  let client = 0;

  for (const r of routes) {
    if (r.kind === 'page') pages++;
    else if (r.kind === 'route-handler') routeHandlers++;
    else if (r.kind === 'api-route') apiRoutes++;

    if (r.dynamicSegments.length > 0) dynamic++;
    if (r.rendering === 'server') server++;
    else if (r.rendering === 'client') client++;
  }

  return {
    total: routes.length,
    pages,
    routeHandlers,
    apiRoutes,
    dynamic,
    server,
    client,
  };
}

async function safeAnalyzeRoutes(projectPath: string): Promise<Route[]> {
  try {
    return await analyzeRoutes(projectPath);
  } catch {
    return [];
  }
}

async function pluginCounts(projectPath: string, pluginManager: any): Promise<Counts> {
  const empty: Counts = { components: 0, customHooks: 0 };
  if (!pluginManager) return empty;

  try {
    const [components, hooks] = await Promise.all([
      pluginManager.executePlugin('component-extractor', projectPath).catch(() => null),
      pluginManager.executePlugin('hook-extractor', projectPath).catch(() => null),
    ]);

    return {
      components:
        components?.success && components?.data?.totalComponents
          ? components.data.totalComponents
          : 0,
      customHooks:
        hooks?.success && hooks?.data?.totalCustomHooks ? hooks.data.totalCustomHooks : 0,
    };
  } catch {
    return empty;
  }
}

function readPackageJson(projectPath: string): { name?: string; version?: string } {
  const p = path.join(projectPath, 'package.json');
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return {};
  }
}

function formatOverview(o: ProjectOverview, format: 'text' | 'markdown'): string {
  return [
    ...formatHeader(o, format),
    ...formatFramework(o.fingerprint.framework, format),
    ...formatRoutes(o.routes, format),
    ...formatCounts(o.counts, format),
    ...formatStack(o.fingerprint.stack, format),
  ].join('\n');
}

type Fmt = 'text' | 'markdown';

function sectionHeader(title: string, format: Fmt): string {
  return format === 'markdown' ? `## ${title}` : `${title}:`;
}

function formatHeader(o: ProjectOverview, format: Fmt): string[] {
  const lines: string[] = [];
  lines.push(format === 'markdown' ? `# ${o.name}` : `Project: ${o.name}`);
  if (o.version) lines.push(`Version: ${o.version}`);
  lines.push('');
  return lines;
}

function formatFramework(fw: ProjectFingerprint['framework'], format: Fmt): string[] {
  return [
    sectionHeader('Framework', format),
    `  Next.js: ${fw.nextVersion ?? 'not detected'}`,
    `  React: ${fw.reactVersion ?? 'not detected'}`,
    `  Router: ${fw.router ?? 'unknown'}`,
    `  TypeScript: ${fw.typescript ? 'yes' : 'no'}`,
    '',
  ];
}

function formatRoutes(r: RouteSummary, format: Fmt): string[] {
  return [
    sectionHeader('Routes', format),
    `  Total: ${r.total}  (pages: ${r.pages}, route handlers: ${r.routeHandlers}, api routes: ${r.apiRoutes})`,
    `  Dynamic: ${r.dynamic}`,
    `  Rendering: ${r.server} server / ${r.client} client`,
    '',
  ];
}

function formatCounts(c: Counts, format: Fmt): string[] {
  return [
    sectionHeader('Code', format),
    `  Components: ${c.components}`,
    `  Custom hooks: ${c.customHooks}`,
    '',
  ];
}

function formatStack(stack: ProjectFingerprint['stack'], format: Fmt): string[] {
  const entries: string[] = [];
  if (stack.styling.length) entries.push(`styling: ${stack.styling.join(', ')}`);
  if (stack.stateManagement.length) entries.push(`state: ${stack.stateManagement.join(', ')}`);
  if (stack.dataFetching.length) entries.push(`data: ${stack.dataFetching.join(', ')}`);
  if (stack.forms.length) entries.push(`forms: ${stack.forms.join(', ')}`);
  if (stack.i18n) entries.push(`i18n: ${stack.i18n}`);
  if (stack.auth) entries.push(`auth: ${stack.auth}`);
  if (stack.dataLayer) entries.push(`db: ${stack.dataLayer}`);
  if (stack.uiKit) entries.push(`ui: ${stack.uiKit}`);

  if (!entries.length) return [];
  return [sectionHeader('Stack', format), ...entries.map((e) => `  ${e}`)];
}
