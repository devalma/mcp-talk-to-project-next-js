/**
 * Analyze Imports Tool
 *
 * For a given file, returns:
 *   - outgoing: what this file imports (local files, external packages, unresolved)
 *   - incoming: which files in the project import this file
 *
 * Resolves relative imports and tsconfig "paths" aliases (e.g. @/*). External
 * package imports are reported verbatim without resolution.
 *
 * Uses @babel/parser so it handles type-only imports, namespace imports,
 * dynamic import(), and `export … from …` re-exports correctly — things a
 * regex would miss.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import { parse } from '@babel/parser';
import type { ToolDefinition, ToolContext } from './types.js';
import { createTextResponse, createErrorResponse } from './types.js';

const ArgsSchema = z.object({
  file: z.string(),
  direction: z.enum(['outgoing', 'incoming', 'both']).default('both').optional(),
  format: z.enum(['text', 'markdown', 'json']).default('json').optional(),
});

type Args = z.infer<typeof ArgsSchema>;

export type ImportKind = 'value' | 'type' | 'dynamic' | 're-export';

export interface OutgoingImport {
  source: string;
  resolvedFile: string | null;
  specifiers: string[]; // e.g. ["useState", "default", "*"]
  kind: ImportKind;
  line: number;
}

export interface IncomingImport {
  file: string;
  specifiers: string[];
  kind: ImportKind;
  line: number;
}

export interface OutgoingBlock {
  local: OutgoingImport[];
  external: OutgoingImport[];
  unresolved: OutgoingImport[];
}

export interface ImportAnalysis {
  file: string;
  outgoing: OutgoingBlock | null;
  incoming: IncomingImport[] | null;
}

export const analyzeImportsTool: ToolDefinition = {
  definition: {
    name: 'analyze_imports',
    description:
      'Import graph for a file. "outgoing" = what this file imports (local files, packages, unresolved aliases). "incoming" = which files in the project import this file. Use this before refactoring to see the blast radius.',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: 'Project-relative or absolute path to the target file.',
        },
        direction: {
          type: 'string',
          enum: ['outgoing', 'incoming', 'both'],
          description:
            'outgoing = what this file imports; incoming = who imports it; both = both. incoming scans the whole project and is slower.',
          default: 'both',
        },
        format: {
          type: 'string',
          enum: ['text', 'markdown', 'json'],
          default: 'json',
        },
      },
      required: ['file'],
    },
  } as Tool,

  handler: async (args: Args, context: ToolContext) => {
    try {
      const parsed = ArgsSchema.parse(args);
      const { file: fileArg, direction = 'both', format = 'json' } = parsed;
      const result = await analyzeImports(context.resolvedProjectPath, fileArg, direction);

      if (format === 'json') {
        return createTextResponse(JSON.stringify(result, null, 2));
      }
      return createTextResponse(formatAnalysis(result, format));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(
          `Invalid arguments: ${error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
        );
      }
      const message = error instanceof Error ? error.message : String(error);
      return createErrorResponse(`Import analysis failed: ${message}`);
    }
  },
};

// ---------- core ----------

export async function analyzeImports(
  projectPath: string,
  fileArg: string,
  direction: 'outgoing' | 'incoming' | 'both'
): Promise<ImportAnalysis> {
  const absTarget = resolveInputPath(projectPath, fileArg);
  if (!fs.existsSync(absTarget)) {
    throw new Error(`File not found: ${fileArg}`);
  }
  const relTarget = path.relative(projectPath, absTarget).replace(/\\/g, '/');
  const aliases = readTsconfigPaths(projectPath);

  const wantOutgoing = direction === 'outgoing' || direction === 'both';
  const wantIncoming = direction === 'incoming' || direction === 'both';

  const outgoing: OutgoingBlock | null = wantOutgoing
    ? categorizeOutgoing(extractImports(absTarget), absTarget, projectPath, aliases)
    : null;

  const incoming: IncomingImport[] | null = wantIncoming
    ? await findIncoming(projectPath, absTarget, aliases)
    : null;

  return { file: relTarget, outgoing, incoming };
}

// ---------- import extraction (AST) ----------

interface ParsedImport {
  source: string;
  specifiers: string[];
  kind: ImportKind;
  line: number;
}

export function extractImports(absFile: string): ParsedImport[] {
  let content: string;
  try {
    content = fs.readFileSync(absFile, 'utf-8');
  } catch {
    return [];
  }
  if (!content.trim()) return [];

  const isTs = absFile.endsWith('.ts') || absFile.endsWith('.tsx');
  const isJsx = absFile.endsWith('.tsx') || absFile.endsWith('.jsx') || absFile.endsWith('.js');

  let ast: any;
  try {
    ast = parse(content, {
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
    });
  } catch {
    return [];
  }

  const results: ParsedImport[] = [];

  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      const specs: string[] = [];
      let hasTypeSpecifier = false;
      for (const s of node.specifiers ?? []) {
        if (s.type === 'ImportDefaultSpecifier') specs.push('default');
        else if (s.type === 'ImportNamespaceSpecifier') specs.push('*');
        else if (s.type === 'ImportSpecifier') {
          const imported = s.imported.type === 'Identifier' ? s.imported.name : s.imported.value;
          specs.push(imported);
          if ((s as any).importKind === 'type') hasTypeSpecifier = true;
        }
      }
      const kind: ImportKind =
        node.importKind === 'type' || (hasTypeSpecifier && specs.length === 1)
          ? 'type'
          : 'value';
      results.push({
        source: node.source.value,
        specifiers: specs,
        kind,
        line: node.loc?.start.line ?? 0,
      });
    } else if (
      node.type === 'ExportNamedDeclaration' &&
      node.source &&
      node.specifiers.length > 0
    ) {
      const specs = node.specifiers.map((s: any) => {
        if (s.type === 'ExportSpecifier') {
          return s.local.type === 'Identifier' ? s.local.name : s.local.value;
        }
        return '*';
      });
      results.push({
        source: node.source.value,
        specifiers: specs,
        kind: 're-export',
        line: node.loc?.start.line ?? 0,
      });
    } else if (node.type === 'ExportAllDeclaration' && node.source) {
      results.push({
        source: node.source.value,
        specifiers: ['*'],
        kind: 're-export',
        line: node.loc?.start.line ?? 0,
      });
    }
  }

  // Dynamic imports: traverse for `import(…)` expressions with string literal
  collectDynamicImports(ast, results);

  return results;
}

function collectDynamicImports(ast: any, out: ParsedImport[]): void {
  function walk(node: any, parentLine: number): void {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'Import' &&
      node.arguments?.[0]?.type === 'StringLiteral'
    ) {
      out.push({
        source: node.arguments[0].value,
        specifiers: [],
        kind: 'dynamic',
        line: node.loc?.start.line ?? parentLine,
      });
    }
    for (const key in node) {
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      const v = node[key];
      if (Array.isArray(v)) for (const c of v) walk(c, node.loc?.start.line ?? parentLine);
      else if (v && typeof v === 'object') walk(v, node.loc?.start.line ?? parentLine);
    }
  }
  walk(ast.program, 0);
}

// ---------- categorization + resolution ----------

function categorizeOutgoing(
  imports: ParsedImport[],
  absFile: string,
  projectPath: string,
  aliases: TsconfigAlias[]
): OutgoingBlock {
  const local: OutgoingImport[] = [];
  const external: OutgoingImport[] = [];
  const unresolved: OutgoingImport[] = [];

  for (const imp of imports) {
    const resolved = resolveImportSource(imp.source, absFile, projectPath, aliases);
    const entry: OutgoingImport = {
      source: imp.source,
      resolvedFile: resolved,
      specifiers: imp.specifiers,
      kind: imp.kind,
      line: imp.line,
    };

    if (isExternalPackage(imp.source, aliases)) {
      external.push(entry);
    } else if (resolved) {
      local.push(entry);
    } else {
      unresolved.push(entry);
    }
  }

  return { local, external, unresolved };
}

function isExternalPackage(source: string, aliases: TsconfigAlias[]): boolean {
  if (source.startsWith('.') || source.startsWith('/')) return false;
  for (const a of aliases) if (matchesAlias(source, a.prefix)) return false;
  return true;
}

const CANDIDATE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

function resolveImportSource(
  source: string,
  fromAbsFile: string,
  projectPath: string,
  aliases: TsconfigAlias[]
): string | null {
  let basedir: string | null = null;
  let rest: string | null = null;

  if (source.startsWith('.') || source.startsWith('/')) {
    basedir = path.dirname(fromAbsFile);
    rest = source;
  } else {
    for (const a of aliases) {
      const mapped = applyAlias(source, a, projectPath);
      if (mapped) {
        const [alias_basedir, alias_rest] = mapped;
        basedir = alias_basedir;
        rest = alias_rest;
        break;
      }
    }
  }

  if (basedir === null || rest === null) return null;

  const base = rest.startsWith('/') ? rest : path.resolve(basedir, rest);

  // Direct file with existing extension
  if (/\.[jt]sx?$|\.mjs$|\.cjs$/.test(base) && fs.existsSync(base) && fs.statSync(base).isFile()) {
    return toProjectRelative(base, projectPath);
  }

  // TS-ESM/NodeNext: imports like './foo.js' map to './foo.ts' on disk.
  // If the base has a .js/.jsx/.mjs/.cjs extension but the file isn't there,
  // try the equivalent TS sources.
  const jsExtMatch = /\.(jsx?|mjs|cjs)$/.exec(base);
  if (jsExtMatch) {
    const withoutExt = base.slice(0, -jsExtMatch[0].length);
    const tsCandidates =
      jsExtMatch[1] === 'jsx' ? ['.tsx', '.jsx'] : ['.ts', '.tsx', '.js', '.jsx'];
    for (const ext of tsCandidates) {
      const candidate = withoutExt + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return toProjectRelative(candidate, projectPath);
      }
    }
  }

  // Try adding extensions
  for (const ext of CANDIDATE_EXTS) {
    const candidate = base + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return toProjectRelative(candidate, projectPath);
    }
  }

  // Try index file inside directory
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const ext of CANDIDATE_EXTS) {
      const candidate = path.join(base, 'index' + ext);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return toProjectRelative(candidate, projectPath);
      }
    }
  }

  return null;
}

function toProjectRelative(absPath: string, projectPath: string): string {
  return path.relative(projectPath, absPath).replace(/\\/g, '/');
}

// ---------- tsconfig paths ----------

interface TsconfigAlias {
  prefix: string; // e.g. "@/"
  targets: string[]; // absolute dirs/files the prefix maps to
}

function readTsconfigPaths(projectPath: string): TsconfigAlias[] {
  const aliases: TsconfigAlias[] = [];
  const tsconfigPath = path.join(projectPath, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) return aliases;

  let tsconfig: any;
  try {
    const raw = fs.readFileSync(tsconfigPath, 'utf-8');
    tsconfig = JSON.parse(stripJsonComments(raw));
  } catch {
    return aliases;
  }

  const baseUrl: string = tsconfig.compilerOptions?.baseUrl || '.';
  const paths: Record<string, string[]> = tsconfig.compilerOptions?.paths || {};
  const baseAbs = path.resolve(projectPath, baseUrl);

  for (const [pattern, targets] of Object.entries(paths)) {
    const prefix = pattern.replace(/\*$/, '');
    const targetPrefixes = (targets as string[]).map((t) =>
      path.resolve(baseAbs, t.replace(/\*$/, ''))
    );
    aliases.push({ prefix, targets: targetPrefixes });
  }

  return aliases;
}

function stripJsonComments(raw: string): string {
  // Minimal: strip // and /* */ comments. Tsconfig commonly uses them.
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function matchesAlias(source: string, prefix: string): boolean {
  return source === prefix.replace(/\/$/, '') || source.startsWith(prefix);
}

function applyAlias(
  source: string,
  alias: TsconfigAlias,
  projectPath: string
): [string, string] | null {
  if (!matchesAlias(source, alias.prefix)) return null;
  const remainder = source.slice(alias.prefix.length);
  for (const target of alias.targets) {
    if (fs.existsSync(target) || fs.existsSync(path.dirname(target))) {
      return [target, remainder || '.'];
    }
  }
  // Even if the target dir doesn't exist yet, use the first target so resolution
  // still tries (and will fail gracefully → unresolved).
  if (alias.targets.length > 0) {
    return [alias.targets[0], remainder || '.'];
  }
  return null;
}

// ---------- incoming scan ----------

async function findIncoming(
  projectPath: string,
  absTarget: string,
  aliases: TsconfigAlias[]
): Promise<IncomingImport[]> {
  const files = await glob('**/*.{ts,tsx,js,jsx,mjs,cjs}', {
    cwd: projectPath,
    nodir: true,
    absolute: true,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.d.ts',
    ],
  });

  const incoming: IncomingImport[] = [];
  for (const f of files) {
    if (path.resolve(f) === path.resolve(absTarget)) continue;
    const imports = extractImports(f);
    for (const imp of imports) {
      const resolved = resolveImportSource(imp.source, f, projectPath, aliases);
      if (resolved && path.resolve(projectPath, resolved) === path.resolve(absTarget)) {
        incoming.push({
          file: toProjectRelative(f, projectPath),
          specifiers: imp.specifiers,
          kind: imp.kind,
          line: imp.line,
        });
      }
    }
  }

  return incoming;
}

// ---------- helpers ----------

function resolveInputPath(projectPath: string, fileArg: string): string {
  if (path.isAbsolute(fileArg)) return fileArg;
  return path.resolve(projectPath, fileArg);
}

function formatAnalysis(a: ImportAnalysis, format: 'text' | 'markdown'): string {
  const lines: string[] = [];
  const h = format === 'markdown' ? '##' : '';
  lines.push(format === 'markdown' ? `# Import analysis: ${a.file}` : `File: ${a.file}`);
  lines.push('');

  if (a.outgoing !== null) {
    lines.push(format === 'markdown' ? `${h} Outgoing` : 'Outgoing:');
    const sections: Array<[string, OutgoingImport[]]> = [
      ['local', a.outgoing.local],
      ['external', a.outgoing.external],
      ['unresolved', a.outgoing.unresolved],
    ];
    for (const [label, list] of sections) {
      if (!list.length) continue;
      lines.push(`  ${label} (${list.length}):`);
      for (const imp of list) {
        const specs = imp.specifiers.length ? ` { ${imp.specifiers.join(', ')} }` : '';
        const resolved = imp.resolvedFile ? ` → ${imp.resolvedFile}` : '';
        const tag = imp.kind === 'value' ? '' : ` [${imp.kind}]`;
        lines.push(`    ${imp.source}${specs}${resolved}${tag}  (L${imp.line})`);
      }
    }
    lines.push('');
  }

  if (a.incoming !== null) {
    lines.push(format === 'markdown' ? `${h} Incoming (${a.incoming.length})` : `Incoming (${a.incoming.length}):`);
    for (const imp of a.incoming) {
      const specs = imp.specifiers.length ? ` { ${imp.specifiers.join(', ')} }` : '';
      const tag = imp.kind === 'value' ? '' : ` [${imp.kind}]`;
      lines.push(`  ${imp.file}${specs}${tag}  (L${imp.line})`);
    }
  }

  return lines.join('\n');
}
