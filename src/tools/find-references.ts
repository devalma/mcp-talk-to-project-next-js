/**
 * Find References Tool
 *
 * For a symbol exported from a given file, finds every place in the project
 * that imports and uses it — including the local name the importer chose
 * (handles renamed / default / namespace imports).
 *
 * Output is LLM-friendly: flat list of { file, line, column, kind } so the
 * caller can surface "where does this break if I rename it?" answers.
 *
 * Uses @babel/parser + a manual walker to keep the dependency surface small.
 * No babel-traverse import (avoids the ESM default-export weirdness that
 * existing plugins had to work around).
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import { parse } from '@babel/parser';
import type { ToolDefinition, ToolContext } from './types.js';
import { createTextResponse, createErrorResponse } from './types.js';
import {
  readTsconfigPaths,
  resolveImportSource,
  toProjectRelative,
  type TsconfigAlias,
} from './shared/module-resolver.js';
import {
  paginate,
  paginationArgsShape,
  paginationJsonSchema,
} from './shared/pagination.js';

const ArgsSchema = z.object({
  symbol: z.string().min(1),
  file: z.string(),
  format: z.enum(['text', 'markdown', 'json']).default('json').optional(),
  ...paginationArgsShape,
});

type Args = z.infer<typeof ArgsSchema>;

export type RefKind = 'import' | 'call' | 'jsx' | 'type' | 'identifier';

export interface Reference {
  file: string;
  line: number;
  column: number;
  kind: RefKind;
  localName: string;
}

export interface FindReferencesResult {
  symbol: string;
  definedIn: string;
  references: Reference[];
  filesScanned: number;
  /** References count BEFORE pagination. */
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
  note?: string;
}

export const findReferencesTool: ToolDefinition = {
  definition: {
    name: 'find_references',
    description:
      'Find all references to a symbol exported from a given file. Returns every import + usage site across the project with line/column and kind (import/call/jsx/type/identifier). Use before renaming or removing an export to see the blast radius.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description:
            'The exported name. For default exports, pass the original name (e.g. "Button") — matches any local alias used by importers.',
        },
        file: {
          type: 'string',
          description: 'The file that defines the symbol (project-relative or absolute).',
        },
        format: {
          type: 'string',
          enum: ['text', 'markdown', 'json'],
          default: 'json',
        },
        ...paginationJsonSchema(),
      },
      required: ['symbol', 'file'],
    },
  } as Tool,

  handler: async (args: Args, context: ToolContext) => {
    try {
      const parsedArgs = ArgsSchema.parse(args);
      const { symbol, file: fileArg, format = 'json', limit, offset } = parsedArgs;
      const result = await findReferences(context.resolvedProjectPath, symbol, fileArg, limit, offset);

      if (format === 'json') {
        return createTextResponse(JSON.stringify(result, null, 2));
      }
      return createTextResponse(formatReferences(result, format));
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.issues
          .map((i) => i.path.join('.') + ': ' + i.message)
          .join(', ');
        return createErrorResponse('Invalid arguments: ' + details);
      }
      const message = error instanceof Error ? error.message : String(error);
      return createErrorResponse(`find_references failed: ${message}`);
    }
  },
};

// ---------- core ----------

export async function findReferences(
  projectPath: string,
  symbol: string,
  fileArg: string,
  limit?: number,
  offset?: number
): Promise<FindReferencesResult> {
  const absTarget = resolveInputPath(projectPath, fileArg);
  if (!fs.existsSync(absTarget)) throw new Error(`File not found: ${fileArg}`);
  const definedIn = toProjectRelative(absTarget, projectPath);
  const aliases = readTsconfigPaths(projectPath);

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

  const references: Reference[] = [];

  for (const abs of files) {
    if (path.resolve(abs) === path.resolve(absTarget)) continue;
    const refs = collectReferencesInFile(abs, absTarget, projectPath, symbol, aliases);
    references.push(...refs);
  }

  // Stable ordering across pages: (file, line, column).
  references.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    if (a.line !== b.line) return a.line - b.line;
    return a.column - b.column;
  });

  const paged = paginate(references, limit, offset);

  return {
    symbol,
    definedIn,
    references: paged.items,
    filesScanned: files.length,
    total: paged.page.total,
    limit: paged.page.limit,
    offset: paged.page.offset,
    hasMore: paged.page.hasMore,
    nextOffset: paged.page.nextOffset,
    ...(paged.note ? { note: paged.note } : {}),
  };
}

interface ResolvedImport {
  localName: string;
  line: number;
  column: number;
}

function collectReferencesInFile(
  absFile: string,
  absTarget: string,
  projectPath: string,
  symbol: string,
  aliases: TsconfigAlias[]
): Reference[] {
  const content = readFileSafe(absFile);
  if (!content.trim()) return [];

  const ast = safeParse(content, absFile);
  if (!ast) return [];

  const matchingImports = findMatchingImports(ast, absFile, absTarget, projectPath, symbol, aliases);
  if (matchingImports.length === 0) return [];

  const relFile = toProjectRelative(absFile, projectPath);
  const refs: Reference[] = [];

  for (const m of matchingImports) {
    refs.push({
      file: relFile,
      line: m.line,
      column: m.column,
      kind: 'import',
      localName: m.localName,
    });
    const usages = findLocalNameUsages(ast, m.localName);
    for (const u of usages) {
      refs.push({
        file: relFile,
        line: u.line,
        column: u.column,
        kind: u.kind,
        localName: m.localName,
      });
    }
  }

  return refs;
}

// ---------- import matching ----------

function findMatchingImports(
  ast: any,
  absFile: string,
  absTarget: string,
  projectPath: string,
  symbol: string,
  aliases: TsconfigAlias[]
): ResolvedImport[] {
  const matches: ResolvedImport[] = [];

  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      if (!resolvesTo(node.source.value, absFile, absTarget, projectPath, aliases)) continue;
      for (const spec of node.specifiers ?? []) {
        const resolved = resolveImportSpecifier(spec, symbol);
        if (resolved) {
          matches.push({
            localName: resolved,
            line: spec.loc?.start.line ?? 0,
            column: spec.loc?.start.column ?? 0,
          });
        }
      }
    } else if (
      (node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') &&
      node.source
    ) {
      if (!resolvesTo(node.source.value, absFile, absTarget, projectPath, aliases)) continue;
      // Re-exports — treat as a reference at the re-export site.
      if (node.type === 'ExportAllDeclaration') {
        matches.push({
          localName: '*',
          line: node.loc?.start.line ?? 0,
          column: node.loc?.start.column ?? 0,
        });
      } else {
        for (const spec of node.specifiers ?? []) {
          if (spec.type !== 'ExportSpecifier') continue;
          const localName = nameOf(spec.local);
          if (localName === symbol) {
            matches.push({
              localName,
              line: spec.loc?.start.line ?? 0,
              column: spec.loc?.start.column ?? 0,
            });
          }
        }
      }
    }
  }

  return matches;
}

function resolveImportSpecifier(spec: any, symbol: string): string | null {
  if (spec.type === 'ImportDefaultSpecifier') {
    // Default import — we can't know the original export name without parsing
    // the target, so we match any default. The caller may narrow by also
    // checking the alias locally; for MVP we always include default imports.
    return spec.local.name;
  }
  if (spec.type === 'ImportSpecifier') {
    const imported = nameOf(spec.imported);
    if (imported === symbol) return spec.local.name;
    return null;
  }
  if (spec.type === 'ImportNamespaceSpecifier') {
    // `import * as ns from '...'` — references to the symbol appear as `ns.symbol`.
    // The localName is the namespace identifier; we'll detect member accesses later.
    return spec.local.name + '.' + symbol;
  }
  return null;
}

function nameOf(ident: any): string {
  if (!ident) return '';
  if (ident.type === 'Identifier') return ident.name;
  if (ident.type === 'StringLiteral') return ident.value;
  return '';
}

// ---------- identifier usage walker ----------

function findLocalNameUsages(
  ast: any,
  localName: string
): Array<{ line: number; column: number; kind: RefKind }> {
  const results: Array<{ line: number; column: number; kind: RefKind }> = [];
  const isNamespaced = localName.includes('.');
  const [nsBase, nsMember] = isNamespaced ? localName.split('.') : [localName, ''];

  function visit(node: any, parent: any, parentKey: string | null) {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'Identifier' && node.name === nsBase && !isNamespaced) {
      const kind = classifyIdentifier(node, parent, parentKey);
      if (kind !== null) {
        results.push({
          line: node.loc?.start.line ?? 0,
          column: node.loc?.start.column ?? 0,
          kind,
        });
      }
    } else if (
      isNamespaced &&
      node.type === 'MemberExpression' &&
      node.object?.type === 'Identifier' &&
      node.object.name === nsBase &&
      node.property?.type === 'Identifier' &&
      node.property.name === nsMember
    ) {
      const kind = classifyIdentifier(node, parent, parentKey);
      results.push({
        line: node.loc?.start.line ?? 0,
        column: node.loc?.start.column ?? 0,
        kind: kind ?? 'identifier',
      });
    } else if (node.type === 'JSXIdentifier' && node.name === nsBase && !isNamespaced) {
      if (parent?.type === 'JSXOpeningElement' || parent?.type === 'JSXClosingElement') {
        results.push({
          line: node.loc?.start.line ?? 0,
          column: node.loc?.start.column ?? 0,
          kind: 'jsx',
        });
      }
    }

    for (const key in node) {
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      const v = (node as any)[key];
      if (Array.isArray(v)) for (const c of v) visit(c, node, key);
      else if (v && typeof v === 'object') visit(v, node, key);
    }
  }

  visit(ast.program, null, null);
  return dedupeByPosition(results);
}

function classifyIdentifier(
  node: any,
  parent: any,
  parentKey: string | null
): RefKind | null {
  if (!parent) return 'identifier';
  // Skip identifiers that are declaring a *new* binding rather than referring
  // to our import.
  if (parent.type === 'ImportSpecifier' || parent.type === 'ImportDefaultSpecifier') {
    return null; // the import itself is reported separately
  }
  if (parent.type === 'ImportNamespaceSpecifier') return null;
  if (parent.type === 'VariableDeclarator' && parentKey === 'id') return null;
  if (
    (parent.type === 'FunctionDeclaration' ||
      parent.type === 'FunctionExpression' ||
      parent.type === 'ArrowFunctionExpression' ||
      parent.type === 'ClassDeclaration') &&
    parentKey === 'id'
  ) {
    return null;
  }
  if (parent.type === 'ObjectProperty' && parentKey === 'key' && !parent.computed) {
    return null; // { symbol: value } — key, not a reference
  }
  if (parent.type === 'MemberExpression' && parentKey === 'property' && !parent.computed) {
    return null; // obj.symbol — property access, not our import
  }

  if (parent.type === 'CallExpression' && parentKey === 'callee') return 'call';
  if (parent.type === 'NewExpression' && parentKey === 'callee') return 'call';
  if (parent.type?.startsWith('TS') || parentKey === 'typeAnnotation') return 'type';
  return 'identifier';
}

function dedupeByPosition<T extends { line: number; column: number; kind: RefKind }>(
  refs: T[]
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of refs) {
    const key = `${r.line}:${r.column}:${r.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

// ---------- resolution helpers ----------

function resolvesTo(
  source: string,
  fromAbsFile: string,
  targetAbsFile: string,
  projectPath: string,
  aliases: TsconfigAlias[]
): boolean {
  const resolved = resolveImportSource(source, fromAbsFile, projectPath, aliases);
  if (!resolved) return false;
  return path.resolve(projectPath, resolved) === path.resolve(targetAbsFile);
}

function resolveInputPath(projectPath: string, fileArg: string): string {
  if (path.isAbsolute(fileArg)) return fileArg;
  return path.resolve(projectPath, fileArg);
}

function readFileSafe(abs: string): string {
  try {
    return fs.readFileSync(abs, 'utf-8');
  } catch {
    return '';
  }
}

function safeParse(content: string, absFile: string): any {
  const isTs = absFile.endsWith('.ts') || absFile.endsWith('.tsx');
  const isJsx = absFile.endsWith('.tsx') || absFile.endsWith('.jsx') || absFile.endsWith('.js');
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
    });
  } catch {
    return null;
  }
}

// ---------- formatting ----------

function formatReferences(
  r: FindReferencesResult,
  format: 'text' | 'markdown'
): string {
  const lines: string[] = [];
  const title = format === 'markdown' ? `# References to ${r.symbol}` : `Symbol: ${r.symbol}`;
  lines.push(title);
  lines.push(`Defined in: ${r.definedIn}`);
  lines.push(`Total: ${r.total}  (scanned ${r.filesScanned} files)`);
  const nextOffsetSuffix = r.nextOffset === null ? '' : ` nextOffset=${r.nextOffset}`;
  lines.push(`Page: offset=${r.offset} limit=${r.limit} hasMore=${r.hasMore}${nextOffsetSuffix}`);
  if (r.note) lines.push(`Note: ${r.note}`);
  lines.push('');

  const byFile = new Map<string, Reference[]>();
  for (const ref of r.references) {
    const arr = byFile.get(ref.file) ?? [];
    arr.push(ref);
    byFile.set(ref.file, arr);
  }

  for (const [file, refs] of byFile) {
    lines.push(format === 'markdown' ? `## ${file}` : `${file}:`);
    for (const ref of refs) {
      lines.push(`  L${ref.line}:${ref.column}  ${ref.kind}  (${ref.localName})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
