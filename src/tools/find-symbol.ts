/**
 * Find Symbol Tool
 *
 * Searches the project for declarations by name, returning every file where
 * a component, hook, function, type, interface, class, or top-level variable
 * with that name is declared. The glue between "I know the name" and the
 * other tools that require a file path (get_component_props, find_references).
 *
 * Classification heuristic:
 *   - Name starts with `use[A-Z]` → hook
 *   - Name is PascalCase AND body contains JSX (or extends React.Component) → component
 *   - Name is PascalCase without JSX → function or class (by declaration type)
 *   - Everything else classified by declaration node type
 *
 * Exported declarations are marked so LLMs can distinguish reachable symbols
 * from local helpers at a glance.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { glob } from 'glob';
import type { ToolDefinition, ToolContext } from './types.js';
import { createTextResponse, createErrorResponse } from './types.js';
import { toProjectRelative } from './shared/module-resolver.js';
import { classifyFunctionKind, extendsReactComponent } from './shared/classify.js';
import { parseFileCached } from './shared/ast-cache.js';
import {
  paginate,
  paginationArgsShape,
  paginationJsonSchema,
} from './shared/pagination.js';

const ArgsSchema = z.object({
  name: z.string().min(1),
  kind: z
    .enum([
      'any',
      'component',
      'hook',
      'function',
      'type',
      'interface',
      'class',
      'variable',
    ])
    .default('any')
    .optional(),
  format: z.enum(['text', 'markdown', 'json']).default('json').optional(),
  ...paginationArgsShape,
});

type Args = z.infer<typeof ArgsSchema>;

export type SymbolKind =
  | 'component'
  | 'hook'
  | 'function'
  | 'type'
  | 'interface'
  | 'class'
  | 'variable';

export interface SymbolMatch {
  file: string;
  name: string;
  kind: SymbolKind;
  exported: boolean;
  default: boolean;
  line: number;
  column: number;
  returnsJsx?: boolean;
}

export interface FindSymbolResult {
  name: string;
  kindFilter: Args['kind'];
  matches: SymbolMatch[];
  filesScanned: number;
  /** Matches count BEFORE pagination. */
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
  note?: string;
}

export const findSymbolTool: ToolDefinition = {
  definition: {
    name: 'find_symbol',
    description:
      'Locate declarations of a symbol by name across the project. Returns every file where the name is declared, with kind (component / hook / function / type / interface / class / variable), exported/default flags, and line/column. Use this when you know the name but not the file — feed the result into get_component_props or find_references.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The symbol name to search for (e.g. "Button", "useAuth", "User").',
        },
        kind: {
          type: 'string',
          enum: [
            'any',
            'component',
            'hook',
            'function',
            'type',
            'interface',
            'class',
            'variable',
          ],
          description: 'Filter by symbol kind. Default "any".',
          default: 'any',
        },
        format: {
          type: 'string',
          enum: ['text', 'markdown', 'json'],
          default: 'json',
        },
        ...paginationJsonSchema(),
      },
      required: ['name'],
    },
  } as Tool,

  handler: async (args: Args, context: ToolContext) => {
    try {
      const { name, kind = 'any', format = 'json', limit, offset } = ArgsSchema.parse(args);
      const result = await findSymbol(context.resolvedProjectPath, name, kind, limit, offset);

      if (format === 'json') {
        return createTextResponse(JSON.stringify(result, null, 2));
      }
      return createTextResponse(formatResult(result, format));
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.issues
          .map((i) => i.path.join('.') + ': ' + i.message)
          .join(', ');
        return createErrorResponse('Invalid arguments: ' + details);
      }
      const message = error instanceof Error ? error.message : String(error);
      return createErrorResponse(`find_symbol failed: ${message}`);
    }
  },
};

// ---------- core ----------

export async function findSymbol(
  projectPath: string,
  name: string,
  kindFilter: Args['kind'] = 'any',
  limit?: number,
  offset?: number
): Promise<FindSymbolResult> {
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

  const matches: SymbolMatch[] = [];

  for (const abs of files) {
    const fileMatches = findInFile(abs, projectPath, name);
    matches.push(...fileMatches);
  }

  const filtered =
    kindFilter === 'any' || !kindFilter
      ? matches
      : matches.filter((m) => m.kind === kindFilter);

  // Stable ordering across pages: (file, line, column).
  filtered.sort(compareByFileLineColumn);

  const paged = paginate(filtered, limit, offset);

  return {
    name,
    kindFilter,
    matches: paged.items,
    filesScanned: files.length,
    total: paged.page.total,
    limit: paged.page.limit,
    offset: paged.page.offset,
    hasMore: paged.page.hasMore,
    nextOffset: paged.page.nextOffset,
    ...(paged.note ? { note: paged.note } : {}),
  };
}

function compareByFileLineColumn(
  a: { file: string; line: number; column: number },
  b: { file: string; line: number; column: number }
): number {
  if (a.file !== b.file) return a.file.localeCompare(b.file);
  if (a.line !== b.line) return a.line - b.line;
  return a.column - b.column;
}

function findInFile(absFile: string, projectPath: string, name: string): SymbolMatch[] {
  const parsed = parseFileCached(absFile);
  if (!parsed) return [];

  const relFile = toProjectRelative(absFile, projectPath);
  const matches: SymbolMatch[] = [];

  for (const node of parsed.ast.program.body) {
    collectTopLevelDeclaration(node, name, relFile, matches, false, false);
  }
  return matches;
}

function collectTopLevelDeclaration(
  node: any,
  name: string,
  file: string,
  out: SymbolMatch[],
  exported: boolean,
  isDefault: boolean
): void {
  if (!node) return;

  // export … declaration
  if (node.type === 'ExportNamedDeclaration' && node.declaration) {
    collectTopLevelDeclaration(node.declaration, name, file, out, true, false);
    return;
  }
  if (node.type === 'ExportDefaultDeclaration') {
    collectTopLevelDeclaration(node.declaration, name, file, out, true, true);
    return;
  }

  // FunctionDeclaration / ClassDeclaration
  if (
    (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') &&
    node.id?.name === name
  ) {
    out.push(makeMatch(node, name, file, exported, isDefault));
    return;
  }

  // TSInterfaceDeclaration / TSTypeAliasDeclaration
  if (node.type === 'TSInterfaceDeclaration' && node.id?.name === name) {
    out.push({
      file,
      name,
      kind: 'interface',
      exported,
      default: isDefault,
      line: node.loc?.start.line ?? 0,
      column: node.loc?.start.column ?? 0,
    });
    return;
  }
  if (node.type === 'TSTypeAliasDeclaration' && node.id?.name === name) {
    out.push({
      file,
      name,
      kind: 'type',
      exported,
      default: isDefault,
      line: node.loc?.start.line ?? 0,
      column: node.loc?.start.column ?? 0,
    });
    return;
  }

  // VariableDeclaration → check each declarator
  if (node.type === 'VariableDeclaration') {
    for (const decl of node.declarations) {
      if (decl.id?.type !== 'Identifier' || decl.id.name !== name) continue;
      out.push(makeVariableMatch(decl, name, file, exported));
    }
  }
}

function makeMatch(
  node: any,
  name: string,
  file: string,
  exported: boolean,
  isDefault: boolean
): SymbolMatch {
  if (node.type === 'ClassDeclaration') {
    const isComponent = extendsReactComponent(node);
    return {
      file,
      name,
      kind: isComponent ? 'component' : 'class',
      exported,
      default: isDefault,
      line: node.loc?.start.line ?? 0,
      column: node.loc?.start.column ?? 0,
    };
  }
  // FunctionDeclaration
  const kind = classifyFunctionKind(name, node);
  const match: SymbolMatch = {
    file,
    name,
    kind,
    exported,
    default: isDefault,
    line: node.loc?.start.line ?? 0,
    column: node.loc?.start.column ?? 0,
  };
  if (kind === 'component') match.returnsJsx = true;
  return match;
}

function makeVariableMatch(
  decl: any,
  name: string,
  file: string,
  exported: boolean
): SymbolMatch {
  const init = decl.init;
  const isFn =
    init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression';
  if (isFn) {
    const kind = classifyFunctionKind(name, init);
    const match: SymbolMatch = {
      file,
      name,
      kind,
      exported,
      default: false,
      line: decl.loc?.start.line ?? 0,
      column: decl.loc?.start.column ?? 0,
    };
    if (kind === 'component') match.returnsJsx = true;
    return match;
  }
  return {
    file,
    name,
    kind: 'variable',
    exported,
    default: false,
    line: decl.loc?.start.line ?? 0,
    column: decl.loc?.start.column ?? 0,
  };
}

// ---------- formatting ----------

function formatResult(r: FindSymbolResult, format: 'text' | 'markdown'): string {
  const matchWord = r.total === 1 ? '' : 'es';
  const title =
    format === 'markdown'
      ? `# find_symbol "${r.name}" (${r.total} match${matchWord})`
      : `Symbol: ${r.name}  [${r.total} match${matchWord}]`;

  const lines: string[] = [title];
  lines.push(`Scanned: ${r.filesScanned} files`);
  if (r.kindFilter && r.kindFilter !== 'any') {
    lines.push(`Filter: kind=${r.kindFilter}`);
  }
  const nextOffsetSuffix = r.nextOffset === null ? '' : ` nextOffset=${r.nextOffset}`;
  lines.push(`Page: offset=${r.offset} limit=${r.limit} hasMore=${r.hasMore}${nextOffsetSuffix}`);
  if (r.note) lines.push(`Note: ${r.note}`);
  lines.push('');

  for (const m of r.matches) {
    const tags: string[] = [m.kind];
    if (m.exported) tags.push(m.default ? 'default-export' : 'exported');
    lines.push(`${m.file}:${m.line}:${m.column}  [${tags.join(', ')}]`);
  }

  return lines.join('\n');
}
