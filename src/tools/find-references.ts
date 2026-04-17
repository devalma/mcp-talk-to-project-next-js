/**
 * Find References Tool
 *
 * For a symbol exported from a given file, finds every place in the project
 * that imports and uses it — including the local name the importer chose
 * (handles renamed / default / namespace imports).
 *
 * Correctness (1.7):
 *   - Barrel re-exports are followed: an importer that reaches the target
 *     through one or more `export … from '…'` files is attributed to the
 *     target, with `via` listing the barrel chain.
 *   - Shadowing is honored: identifiers whose nearest binding is not the
 *     matched import are not reported.
 *
 * Output is LLM-friendly: flat list of { file, line, column, kind, via? } so
 * the caller can surface "where does this break if I rename it?" answers.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import traverseMod from '@babel/traverse';
import type { ToolDefinition, ToolContext } from './types.js';
import { createTextResponse, createErrorResponse } from './types.js';
import {
  readTsconfigPaths,
  resolveImportSource,
  toProjectRelative,
  type TsconfigAlias,
} from './shared/module-resolver.js';
import { parseFileCached } from './shared/ast-cache.js';
import {
  paginate,
  paginationArgsShape,
  paginationJsonSchema,
} from './shared/pagination.js';

// ESM default-export workaround for @babel/traverse — same pattern as
// src/plugins/common/ast-utils.ts.
const traverse: typeof traverseMod =
  typeof traverseMod === 'function' ? traverseMod : (traverseMod as any).default;

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
  /**
   * Barrel chain the reference passed through, nearest-to-importer first.
   * Absent for direct imports. Each entry is a project-relative path.
   */
  via?: string[];
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

  const targets = buildTargetIndex(absTarget, symbol, files, projectPath, aliases);

  const references: Reference[] = [];

  for (const abs of files) {
    if (path.resolve(abs) === path.resolve(absTarget)) continue;
    const refs = collectReferencesInFile(abs, targets, projectPath, aliases);
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

// ---------- barrel re-export index ----------

interface BarrelEdge {
  from: string;                              // abs path of the re-exporting file
  to: string;                                // abs path of the source it re-exports from
  kind: 'named' | 'star' | 'default-as';
  originalName: string;                      // name as exported by `to` ('*' for star, 'default' for default-as)
  exposedName: string;                       // name this edge exposes outward ('*' for star)
  line: number;
  column: number;
}

/**
 * A file path + the name at which `symbol` is exposed there.
 * `via` is the barrel chain (nearest-to-importer first). Direct target has via=[].
 */
interface ResolvedTarget {
  absFile: string;
  exposedName: string;
  via: string[];                             // project-relative paths
}

function collectBarrelEdges(
  absFile: string,
  projectPath: string,
  aliases: TsconfigAlias[]
): BarrelEdge[] {
  const parsed = parseFileCached(absFile);
  if (!parsed) return [];
  const edges: BarrelEdge[] = [];

  for (const node of parsed.ast.program.body) {
    const source = (node as any).source?.value;
    if (!source) continue;
    const resolved = resolveImportSource(source, absFile, projectPath, aliases);
    if (!resolved) continue;                 // third-party source — don't follow
    const to = path.resolve(projectPath, resolved);

    if (node.type === 'ExportNamedDeclaration') {
      for (const spec of (node as any).specifiers ?? []) {
        if (spec.type !== 'ExportSpecifier') continue;
        const local = nameOf(spec.local);
        const exported = nameOf(spec.exported);
        const isDefault = local === 'default';
        edges.push({
          from: absFile,
          to,
          kind: isDefault ? 'default-as' : 'named',
          originalName: isDefault ? 'default' : local,
          exposedName: exported,
          line: spec.loc?.start.line ?? 0,
          column: spec.loc?.start.column ?? 0,
        });
      }
    } else if (node.type === 'ExportAllDeclaration') {
      // `export * as ns from '…'` has node.exported set — skip per 1.7 scope.
      if ((node as any).exported) continue;
      edges.push({
        from: absFile,
        to,
        kind: 'star',
        originalName: '*',
        exposedName: '*',
        line: node.loc?.start.line ?? 0,
        column: node.loc?.start.column ?? 0,
      });
    }
  }
  return edges;
}

/**
 * Does the target file's `export default` refer to a declaration whose
 * name is `symbol`? Needed so that `export { default as X } from 'target'`
 * can be recognized as re-exposing the queried symbol as X.
 */
function targetDefaultMatches(absTarget: string, symbol: string): boolean {
  const parsed = parseFileCached(absTarget);
  if (!parsed) return false;
  for (const node of parsed.ast.program.body) {
    if (node.type !== 'ExportDefaultDeclaration') continue;
    const decl: any = (node as any).declaration;
    if (!decl) continue;
    if (decl.type === 'Identifier') return decl.name === symbol;
    if (
      (decl.type === 'FunctionDeclaration' ||
        decl.type === 'ClassDeclaration' ||
        decl.type === 'FunctionExpression' ||
        decl.type === 'ClassExpression') &&
      decl.id?.name === symbol
    ) {
      return true;
    }
  }
  return false;
}

function buildTargetIndex(
  absTarget: string,
  symbol: string,
  files: string[],
  projectPath: string,
  aliases: TsconfigAlias[]
): ResolvedTarget[] {
  // Collect every re-export edge in the project, indexed by its `to`.
  const edgesByTo = new Map<string, BarrelEdge[]>();
  for (const f of files) {
    const fAbs = path.resolve(f);
    const edges = collectBarrelEdges(fAbs, projectPath, aliases);
    for (const e of edges) {
      const key = path.resolve(e.to);
      const arr = edgesByTo.get(key) ?? [];
      arr.push(e);
      edgesByTo.set(key, arr);
    }
  }

  const targetIsDefaultNamedSymbol = targetDefaultMatches(absTarget, symbol);

  const targets: ResolvedTarget[] = [
    { absFile: path.resolve(absTarget), exposedName: symbol, via: [] },
  ];
  const visited = new Set<string>([path.resolve(absTarget) + '|' + symbol]);
  const queue: Array<{ absFile: string; name: string; via: string[] }> = [
    { absFile: path.resolve(absTarget), name: symbol, via: [] },
  ];

  while (queue.length) {
    const cur = queue.shift()!;
    const edges = edgesByTo.get(cur.absFile) ?? [];
    for (const e of edges) {
      const nextName = mapNameAcrossEdge(e, cur, absTarget, targetIsDefaultNamedSymbol, symbol);
      if (!nextName) continue;
      const fromAbs = path.resolve(e.from);
      const key = fromAbs + '|' + nextName;
      if (visited.has(key)) continue;
      visited.add(key);
      const newVia = [toProjectRelative(fromAbs, projectPath), ...cur.via];
      targets.push({ absFile: fromAbs, exposedName: nextName, via: newVia });
      queue.push({ absFile: fromAbs, name: nextName, via: newVia });
    }
  }

  return targets;
}

function mapNameAcrossEdge(
  edge: BarrelEdge,
  cur: { absFile: string; name: string },
  absTarget: string,
  targetIsDefaultNamedSymbol: boolean,
  symbol: string
): string | null {
  if (edge.kind === 'named') {
    return edge.originalName === cur.name ? edge.exposedName : null;
  }
  if (edge.kind === 'star') {
    return cur.name;                         // star re-exports preserve names
  }
  // default-as: only fires at the first hop out of the target file, and only
  // when the target's default binding names `symbol`. After that, the name
  // propagates like a named export.
  if (
    edge.kind === 'default-as' &&
    cur.absFile === path.resolve(absTarget) &&
    cur.name === symbol &&
    targetIsDefaultNamedSymbol
  ) {
    return edge.exposedName;
  }
  return null;
}

// ---------- per-file reference collection ----------

interface ResolvedImport {
  localName: string;
  line: number;
  column: number;
  specNode?: any;                            // binding identity for scope check; unset for re-export matches
  via: string[];                             // barrel chain for this match
}

function collectReferencesInFile(
  absFile: string,
  targets: ResolvedTarget[],
  projectPath: string,
  aliases: TsconfigAlias[]
): Reference[] {
  const parsed = parseFileCached(absFile);
  if (!parsed) return [];
  const ast = parsed.ast;

  const matchingImports = findMatchingImports(ast, absFile, targets, projectPath, aliases);
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
      ...(m.via.length ? { via: m.via } : {}),
    });
    if (!m.specNode) continue;               // re-export match — no in-file usages to chase
    const usages = findLocalNameUsages(ast, m.localName, m.specNode);
    for (const u of usages) {
      refs.push({
        file: relFile,
        line: u.line,
        column: u.column,
        kind: u.kind,
        localName: m.localName,
        ...(m.via.length ? { via: m.via } : {}),
      });
    }
  }

  return refs;
}

// ---------- import matching ----------

function targetForSource(
  source: string,
  importerAbsFile: string,
  targets: ResolvedTarget[],
  projectPath: string,
  aliases: TsconfigAlias[]
): ResolvedTarget | null {
  const resolved = resolveImportSource(source, importerAbsFile, projectPath, aliases);
  if (!resolved) return null;
  const resolvedAbs = path.resolve(projectPath, resolved);
  for (const t of targets) {
    if (t.absFile === resolvedAbs) return t;
  }
  return null;
}

function findMatchingImports(
  ast: any,
  absFile: string,
  targets: ResolvedTarget[],
  projectPath: string,
  aliases: TsconfigAlias[]
): ResolvedImport[] {
  const matches: ResolvedImport[] = [];

  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      const tgt = targetForSource(node.source.value, absFile, targets, projectPath, aliases);
      if (!tgt) continue;
      for (const spec of node.specifiers ?? []) {
        const resolved = resolveImportSpecifier(spec, tgt.exposedName);
        if (resolved) {
          matches.push({
            localName: resolved,
            line: spec.loc?.start.line ?? 0,
            column: spec.loc?.start.column ?? 0,
            specNode: spec,
            via: tgt.via,
          });
        }
      }
    } else if (
      (node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') &&
      node.source
    ) {
      const tgt = targetForSource(node.source.value, absFile, targets, projectPath, aliases);
      if (!tgt) continue;
      // Re-export lines count as references at the re-export site.
      if (node.type === 'ExportAllDeclaration') {
        matches.push({
          localName: '*',
          line: node.loc?.start.line ?? 0,
          column: node.loc?.start.column ?? 0,
          via: tgt.via,
        });
      } else {
        for (const spec of node.specifiers ?? []) {
          if (spec.type !== 'ExportSpecifier') continue;
          const localName = nameOf(spec.local);
          // Named re-export whose `local` matches how the target exposes the
          // symbol (post-mapping). `star` targets expose '*' so we skip.
          if (tgt.exposedName !== '*' && localName === tgt.exposedName) {
            matches.push({
              localName,
              line: spec.loc?.start.line ?? 0,
              column: spec.loc?.start.column ?? 0,
              via: tgt.via,
            });
          }
        }
      }
    }
  }

  return matches;
}

function resolveImportSpecifier(spec: any, exposedName: string): string | null {
  if (spec.type === 'ImportDefaultSpecifier') {
    // Default import — we can't know the original export name without parsing
    // the target, so we match any default. The caller may narrow by also
    // checking the alias locally; for MVP we always include default imports.
    return spec.local.name;
  }
  if (spec.type === 'ImportSpecifier') {
    const imported = nameOf(spec.imported);
    if (imported === exposedName) return spec.local.name;
    return null;
  }
  if (spec.type === 'ImportNamespaceSpecifier') {
    // `import * as ns from '...'` — references appear as `ns.<exposedName>`.
    return spec.local.name + '.' + exposedName;
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

/**
 * Walk `ast` and report every reference to `localName` whose nearest binding
 * is the import spec we matched. Shadowing local declarations (params,
 * `const`s, destructured bindings) do not count.
 *
 * For namespaced imports (`import * as ns from '…'`), `localName` is `ns.member`
 * and we detect `MemberExpression(ns.member)` whose `ns` binding is our import.
 */
function findLocalNameUsages(
  ast: any,
  localName: string,
  importSpecNode: any
): Array<{ line: number; column: number; kind: RefKind }> {
  const results: Array<{ line: number; column: number; kind: RefKind }> = [];
  const isNamespaced = localName.includes('.');
  const [nsBase, nsMember] = isNamespaced ? localName.split('.') : [localName, ''];
  const baseName = isNamespaced ? nsBase : localName;

  const isOurBinding = (scope: any): boolean => {
    const binding = scope?.getBinding?.(baseName);
    return !!binding && binding.path?.node === importSpecNode;
  };

  traverse(ast, {
    Identifier(p: any) {
      const node = p.node;
      if (node.name !== baseName) return;

      if (isNamespaced) {
        const parent = p.parent;
        if (parent?.type !== 'MemberExpression' || parent.object !== node) return;
        if (parent.computed) return;
        if (parent.property?.type !== 'Identifier' || parent.property.name !== nsMember) return;
        if (!isOurBinding(p.scope)) return;
        const grandparent = p.parentPath?.parent;
        const grandparentKey = p.parentPath?.parentKey;
        const kind = classifyIdentifier(parent, grandparent, grandparentKey) ?? 'identifier';
        results.push({
          line: parent.loc?.start.line ?? 0,
          column: parent.loc?.start.column ?? 0,
          kind,
        });
        return;
      }

      const kind = classifyIdentifier(node, p.parent, p.parentKey);
      if (kind === null) return;
      if (!isOurBinding(p.scope)) return;
      results.push({
        line: node.loc?.start.line ?? 0,
        column: node.loc?.start.column ?? 0,
        kind,
      });
    },
    JSXIdentifier(p: any) {
      if (isNamespaced) return;
      const node = p.node;
      if (node.name !== baseName) return;
      const parent = p.parent;
      if (parent?.type !== 'JSXOpeningElement' && parent?.type !== 'JSXClosingElement') return;
      if (!isOurBinding(p.scope)) return;
      results.push({
        line: node.loc?.start.line ?? 0,
        column: node.loc?.start.column ?? 0,
        kind: 'jsx',
      });
    },
  });
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

function resolveInputPath(projectPath: string, fileArg: string): string {
  if (path.isAbsolute(fileArg)) return fileArg;
  return path.resolve(projectPath, fileArg);
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
