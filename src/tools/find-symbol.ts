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
import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import { parse } from '@babel/parser';
import type { ToolDefinition, ToolContext } from './types.js';
import { createTextResponse, createErrorResponse } from './types.js';
import { toProjectRelative } from './shared/module-resolver.js';
import { classifyFunctionKind, extendsReactComponent } from './shared/classify.js';

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
  total: number;
  filesScanned: number;
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
      },
      required: ['name'],
    },
  } as Tool,

  handler: async (args: Args, context: ToolContext) => {
    try {
      const { name, kind = 'any', format = 'json' } = ArgsSchema.parse(args);
      const result = await findSymbol(context.resolvedProjectPath, name, kind);

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
  kindFilter: Args['kind'] = 'any'
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

  return {
    name,
    kindFilter,
    matches: filtered,
    total: filtered.length,
    filesScanned: files.length,
  };
}

function findInFile(absFile: string, projectPath: string, name: string): SymbolMatch[] {
  const content = readFileSafe(absFile);
  if (!content.trim()) return [];
  const ast = safeParse(content, absFile);
  if (!ast) return [];

  const relFile = toProjectRelative(absFile, projectPath);
  const matches: SymbolMatch[] = [];

  for (const node of ast.program.body) {
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

// ---------- helpers ----------

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
      plugins: [
        'decorators-legacy',
        'dynamicImport',
        'exportDefaultFrom',
        'optionalChaining',
        'nullishCoalescingOperator',
        ...(isTs ? (['typescript'] as const) : []),
        ...(isJsx ? (['jsx'] as const) : []),
      ] as any,
    });
  } catch {
    return null;
  }
}

// ---------- formatting ----------

function formatResult(r: FindSymbolResult, format: 'text' | 'markdown'): string {
  const lines: string[] = [];
  lines.push(
    format === 'markdown'
      ? `# find_symbol "${r.name}" (${r.total} match${r.total === 1 ? '' : 'es'})`
      : `Symbol: ${r.name}  [${r.total} match${r.total === 1 ? '' : 'es'}]`
  );
  lines.push(`Scanned: ${r.filesScanned} files`);
  if (r.kindFilter && r.kindFilter !== 'any') {
    lines.push(`Filter: kind=${r.kindFilter}`);
  }
  lines.push('');

  for (const m of r.matches) {
    const tags: string[] = [m.kind];
    if (m.exported) tags.push(m.default ? 'default-export' : 'exported');
    lines.push(`${m.file}:${m.line}:${m.column}  [${tags.join(', ')}]`);
  }

  return lines.join('\n');
}
