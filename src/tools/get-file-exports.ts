/**
 * Get File Exports Tool
 *
 * For a given file, lists every top-level export with its name, kind, and
 * default flag. The question this answers is: "what does this file expose?" —
 * always the step before writing an import statement.
 *
 * Covers:
 *   - export function / class / const / let / var / interface / type / enum
 *   - export default …  (named when the declaration has a name)
 *   - export { A, B as C }            → kind classified by local declaration
 *   - export { X } from './y'         → kind = 're-export', source recorded
 *   - export * from './y'             → kind = 're-export-all'
 *   - export * as ns from './y'       → kind = 're-export-ns'
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import type { ToolDefinition, ToolContext } from './types.js';
import { createTextResponse, createErrorResponse } from './types.js';
import { toProjectRelative } from './shared/module-resolver.js';
import { parseFileCached } from './shared/ast-cache.js';
import {
  classifyFunctionKind,
  extendsReactComponent,
  functionReturnsJsx,
} from './shared/classify.js';

const ArgsSchema = z.object({
  file: z.string(),
  format: z.enum(['text', 'markdown', 'json']).default('json').optional(),
});

type Args = z.infer<typeof ArgsSchema>;

export type ExportKind =
  | 'component'
  | 'hook'
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'variable'
  | 're-export'
  | 're-export-all'
  | 're-export-ns'
  | 'unknown';

export interface FileExport {
  name: string;
  kind: ExportKind;
  default: boolean;
  line: number;
  column: number;
  /** For re-exports: the original module the symbol comes from. */
  source?: string;
  /** For re-exports: the name as exported by the source module (post rename). */
  originalName?: string;
}

export interface GetFileExportsResult {
  file: string;
  exports: FileExport[];
  total: number;
}

export const getFileExportsTool: ToolDefinition = {
  definition: {
    name: 'get_file_exports',
    description:
      'List every top-level export in a file: name, kind (component / hook / function / class / interface / type / enum / variable / re-export*), default flag, and line. Use this before writing an import to know exactly what the file exposes.',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: 'The file to inspect (project-relative or absolute).',
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
      const { file: fileArg, format = 'json' } = ArgsSchema.parse(args);
      const result = getFileExports(context.resolvedProjectPath, fileArg);

      if (format === 'json') {
        return createTextResponse(JSON.stringify(result, null, 2));
      }
      return createTextResponse(formatExports(result, format));
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.issues
          .map((i) => i.path.join('.') + ': ' + i.message)
          .join(', ');
        return createErrorResponse('Invalid arguments: ' + details);
      }
      const message = error instanceof Error ? error.message : String(error);
      return createErrorResponse(`get_file_exports failed: ${message}`);
    }
  },
};

// ---------- core ----------

export function getFileExports(
  projectPath: string,
  fileArg: string
): GetFileExportsResult {
  const absFile = resolveInputPath(projectPath, fileArg);
  if (!fs.existsSync(absFile)) throw new Error(`File not found: ${fileArg}`);
  const relFile = toProjectRelative(absFile, projectPath);

  const exports: FileExport[] = [];
  const parsed = parseFileCached(absFile);
  if (!parsed) return { file: relFile, exports, total: 0 };

  for (const node of parsed.ast.program.body) {
    collectExport(node, exports);
  }
  return { file: relFile, exports, total: exports.length };
}

// ---------- AST walkers ----------

function collectExport(node: any, out: FileExport[]): void {
  if (!node) return;

  if (node.type === 'ExportNamedDeclaration') {
    if (node.source) {
      // export { A, B as C } from './mod'  |  export * as ns from './mod'
      collectReExports(node, out);
      return;
    }
    if (node.declaration) {
      collectFromDeclaration(node.declaration, out, false);
      return;
    }
    // export { A, B as C }  —  classify based on... we don't have the
    // declaration here. Record as 'unknown'; consumers can cross-ref to
    // find_symbol for detail.
    for (const spec of node.specifiers ?? []) {
      if (spec.type !== 'ExportSpecifier') continue;
      const exported = nameOfIdent(spec.exported);
      if (!exported) continue;
      out.push({
        name: exported,
        kind: 'unknown',
        default: false,
        line: spec.loc?.start.line ?? 0,
        column: spec.loc?.start.column ?? 0,
      });
    }
    return;
  }

  if (node.type === 'ExportDefaultDeclaration') {
    collectFromDeclaration(node.declaration, out, true);
    return;
  }

  if (node.type === 'ExportAllDeclaration') {
    const source = node.source?.value ?? '';
    // export * as ns from './mod'
    if (node.exported) {
      const nsName = nameOfIdent(node.exported) ?? '*';
      out.push({
        name: nsName,
        kind: 're-export-ns',
        default: false,
        line: node.loc?.start.line ?? 0,
        column: node.loc?.start.column ?? 0,
        source,
      });
      return;
    }
    out.push({
      name: '*',
      kind: 're-export-all',
      default: false,
      line: node.loc?.start.line ?? 0,
      column: node.loc?.start.column ?? 0,
      source,
    });
  }
}

function collectReExports(node: any, out: FileExport[]): void {
  const source = node.source?.value ?? '';
  for (const spec of node.specifiers ?? []) {
    // export { A }, export { A as B }  from './mod'
    if (spec.type === 'ExportSpecifier') {
      const exported = nameOfIdent(spec.exported);
      const original = nameOfIdent(spec.local);
      if (!exported) continue;
      const entry: FileExport = {
        name: exported,
        kind: 're-export',
        default: false,
        line: spec.loc?.start.line ?? 0,
        column: spec.loc?.start.column ?? 0,
        source,
      };
      if (original && original !== exported) entry.originalName = original;
      out.push(entry);
      continue;
    }
    // export * as ns from './mod'  (babel lowers this to an ExportNamespaceSpecifier)
    if (spec.type === 'ExportNamespaceSpecifier') {
      const nsName = nameOfIdent(spec.exported) ?? '*';
      out.push({
        name: nsName,
        kind: 're-export-ns',
        default: false,
        line: spec.loc?.start.line ?? 0,
        column: spec.loc?.start.column ?? 0,
        source,
      });
    }
  }
}

function collectFromDeclaration(
  decl: any,
  out: FileExport[],
  isDefault: boolean
): void {
  if (!decl) return;

  if (decl.type === 'FunctionDeclaration') {
    const name = decl.id?.name ?? (isDefault ? 'default' : null);
    if (!name) return;
    out.push({
      name,
      kind: classifyFunctionKind(name, decl),
      default: isDefault,
      line: decl.loc?.start.line ?? 0,
      column: decl.loc?.start.column ?? 0,
    });
    return;
  }

  if (decl.type === 'ClassDeclaration') {
    const name = decl.id?.name ?? (isDefault ? 'default' : null);
    if (!name) return;
    out.push({
      name,
      kind: extendsReactComponent(decl) ? 'component' : 'class',
      default: isDefault,
      line: decl.loc?.start.line ?? 0,
      column: decl.loc?.start.column ?? 0,
    });
    return;
  }

  if (decl.type === 'TSInterfaceDeclaration') {
    const name = decl.id?.name;
    if (!name) return;
    out.push({
      name,
      kind: 'interface',
      default: isDefault,
      line: decl.loc?.start.line ?? 0,
      column: decl.loc?.start.column ?? 0,
    });
    return;
  }

  if (decl.type === 'TSTypeAliasDeclaration') {
    const name = decl.id?.name;
    if (!name) return;
    out.push({
      name,
      kind: 'type',
      default: isDefault,
      line: decl.loc?.start.line ?? 0,
      column: decl.loc?.start.column ?? 0,
    });
    return;
  }

  if (decl.type === 'TSEnumDeclaration') {
    const name = decl.id?.name;
    if (!name) return;
    out.push({
      name,
      kind: 'enum',
      default: isDefault,
      line: decl.loc?.start.line ?? 0,
      column: decl.loc?.start.column ?? 0,
    });
    return;
  }

  if (decl.type === 'VariableDeclaration') {
    for (const d of decl.declarations) {
      if (d.id?.type !== 'Identifier') continue;
      const name = d.id.name;
      out.push(makeVariableExport(d, name, false));
    }
    return;
  }

  // Default export of an expression: export default foo; export default () => ...
  if (isDefault) {
    if (decl.type === 'Identifier') {
      out.push({
        name: decl.name,
        kind: 'unknown',
        default: true,
        line: decl.loc?.start.line ?? 0,
        column: decl.loc?.start.column ?? 0,
      });
      return;
    }
    if (
      decl.type === 'ArrowFunctionExpression' ||
      decl.type === 'FunctionExpression' ||
      decl.type === 'ClassExpression'
    ) {
      const inferred = decl.id?.name;
      let kind: ExportKind;
      if (decl.type === 'ClassExpression') {
        kind = extendsReactComponent(decl) ? 'component' : 'class';
      } else if (inferred) {
        kind = classifyFunctionKind(inferred, decl);
      } else {
        // Anonymous function/arrow default — can't use name-based heuristics,
        // so classify directly by JSX-return detection.
        kind = functionReturnsJsx(decl) ? 'component' : 'function';
      }
      out.push({
        name: 'default',
        kind,
        default: true,
        line: decl.loc?.start.line ?? 0,
        column: decl.loc?.start.column ?? 0,
      });
      return;
    }
    out.push({
      name: 'default',
      kind: 'unknown',
      default: true,
      line: decl.loc?.start.line ?? 0,
      column: decl.loc?.start.column ?? 0,
    });
  }
}

function makeVariableExport(decl: any, name: string, isDefault: boolean): FileExport {
  const init = decl.init;
  const isFn =
    init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression';
  const kind: ExportKind = isFn ? classifyFunctionKind(name, init) : 'variable';
  return {
    name,
    kind,
    default: isDefault,
    line: decl.loc?.start.line ?? 0,
    column: decl.loc?.start.column ?? 0,
  };
}

// ---------- helpers ----------

function nameOfIdent(node: any): string | null {
  if (!node) return null;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'StringLiteral') return node.value;
  return null;
}

function resolveInputPath(projectPath: string, fileArg: string): string {
  if (path.isAbsolute(fileArg)) return fileArg;
  return path.resolve(projectPath, fileArg);
}

// ---------- formatting ----------

function formatExports(r: GetFileExportsResult, format: 'text' | 'markdown'): string {
  const lines: string[] = [];
  lines.push(
    format === 'markdown'
      ? `# ${r.file} (${r.total} export${r.total === 1 ? '' : 's'})`
      : `File: ${r.file}  [${r.total} export${r.total === 1 ? '' : 's'}]`
  );
  lines.push('');

  for (const e of r.exports) {
    const tags: string[] = [e.kind];
    if (e.default) tags.push('default');
    const src = e.source
      ? `  from "${e.source}"${e.originalName ? ` (as ${e.originalName})` : ''}`
      : '';
    lines.push(`${e.line}:${e.column}  ${e.name}  [${tags.join(', ')}]${src}`);
  }

  return lines.join('\n');
}
