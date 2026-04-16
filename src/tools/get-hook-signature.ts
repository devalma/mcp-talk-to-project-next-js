/**
 * Get Hook Signature Tool
 *
 * For a named custom hook in a given file, extracts the call signature:
 * parameter names, types (as source text), required vs optional, default
 * values, and the explicit return-type annotation if present.
 *
 * This is the hooks-mirror of get_component_props. React apps are hook-heavy,
 * so knowing a hook's parameters / return type is a common prerequisite to
 * writing the call site.
 *
 * Handles:
 *   - function useThing(a: A, b?: B) {}
 *   - export function useThing(...) {}
 *   - export default function useThing(...) {}
 *   - const useThing = (a: A): R => {}          (arrow / function expressions)
 *   - destructured params:
 *       function useThing({ a, b }: Options) {}
 *       function useThing([a, b]: readonly [A, B]) {}
 *     → each destructured binding becomes a single "options / tuple" entry
 *       with its full annotation as the type.
 *   - rest params: function useThing(...rest: A[]) {}
 *
 * Return type:
 *   - If annotated (`function useX(): R` / `const useX = (): R => …`), returned
 *     as TS source text.
 *   - If not annotated → null (inferred).
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import type { ToolDefinition, ToolContext } from './types.js';
import { createTextResponse, createErrorResponse } from './types.js';
import { toProjectRelative } from './shared/module-resolver.js';

const ArgsSchema = z.object({
  hook: z.string().min(1),
  file: z.string(),
  format: z.enum(['text', 'markdown', 'json']).default('json').optional(),
});

type Args = z.infer<typeof ArgsSchema>;

export interface HookParam {
  name: string;
  type: string;
  required: boolean;
  /** True when the param is destructured (`{ a, b }: Options` or `[a]: T`). */
  destructured?: boolean;
  /** True when the param is a rest spread (`...args: T[]`). */
  rest?: boolean;
}

export interface HookSignatureResult {
  name: string;
  file: string;
  found: boolean;
  kind: 'function' | 'arrow' | 'unknown' | null;
  parameters: HookParam[];
  returnType: string | null;
  notes: string[];
}

export const getHookSignatureTool: ToolDefinition = {
  definition: {
    name: 'get_hook_signature',
    description:
      'Extract the call signature of a named custom React hook in a given file: parameter names, types (as TS source text), required/optional, and explicit return-type annotation. Mirror of get_component_props for hooks. Returns null returnType when inferred.',
    inputSchema: {
      type: 'object',
      properties: {
        hook: {
          type: 'string',
          description: 'The hook name (e.g. "useAuth").',
        },
        file: {
          type: 'string',
          description: 'The file that defines the hook (project-relative or absolute).',
        },
        format: {
          type: 'string',
          enum: ['text', 'markdown', 'json'],
          default: 'json',
        },
      },
      required: ['hook', 'file'],
    },
  } as Tool,

  handler: async (args: Args, context: ToolContext) => {
    try {
      const { hook, file: fileArg, format = 'json' } = ArgsSchema.parse(args);
      const result = getHookSignature(context.resolvedProjectPath, hook, fileArg);

      if (format === 'json') {
        return createTextResponse(JSON.stringify(result, null, 2));
      }
      return createTextResponse(formatSignature(result, format));
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.issues
          .map((i) => i.path.join('.') + ': ' + i.message)
          .join(', ');
        return createErrorResponse('Invalid arguments: ' + details);
      }
      const message = error instanceof Error ? error.message : String(error);
      return createErrorResponse(`get_hook_signature failed: ${message}`);
    }
  },
};

// ---------- core ----------

export function getHookSignature(
  projectPath: string,
  hook: string,
  fileArg: string
): HookSignatureResult {
  const absFile = resolveInputPath(projectPath, fileArg);
  if (!fs.existsSync(absFile)) throw new Error(`File not found: ${fileArg}`);
  const relFile = toProjectRelative(absFile, projectPath);

  const notFound = (note: string): HookSignatureResult => ({
    name: hook,
    file: relFile,
    found: false,
    kind: null,
    parameters: [],
    returnType: null,
    notes: [note],
  });

  const content = readFileSafe(absFile);
  if (!content.trim()) return notFound('File is empty');

  const ast = safeParse(content, absFile);
  if (!ast) return notFound('File failed to parse');

  const found = findHook(ast, hook);
  if (!found) return notFound(`Hook "${hook}" not found in ${relFile}`);

  const notes: string[] = [];
  const parameters = extractParams(found.fn.params ?? [], content, notes);
  const returnType = extractReturnType(found.fn, content);

  return {
    name: hook,
    file: relFile,
    found: true,
    kind: found.kind,
    parameters,
    returnType,
    notes,
  };
}

// ---------- hook discovery ----------

interface FoundHook {
  fn: any; // FunctionDeclaration | FunctionExpression | ArrowFunctionExpression
  kind: 'function' | 'arrow' | 'unknown';
}

function findHook(ast: any, name: string): FoundHook | null {
  for (const node of ast.program.body) {
    const direct = matchTopLevel(node, name);
    if (direct) return direct;
    if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      const match = matchTopLevel(node.declaration, name);
      if (match) return match;
    }
    if (node.type === 'ExportDefaultDeclaration' && node.declaration) {
      const match = matchTopLevel(node.declaration, name);
      if (match) return match;
    }
  }
  return null;
}

function matchTopLevel(node: any, name: string): FoundHook | null {
  if (node.type === 'FunctionDeclaration' && node.id?.name === name) {
    return { fn: node, kind: 'function' };
  }
  if (node.type === 'VariableDeclaration') {
    for (const decl of node.declarations) {
      if (decl.id?.type !== 'Identifier' || decl.id.name !== name) continue;
      const init = decl.init;
      if (!init) continue;
      if (init.type === 'ArrowFunctionExpression') return { fn: init, kind: 'arrow' };
      if (init.type === 'FunctionExpression') return { fn: init, kind: 'function' };
    }
  }
  return null;
}

// ---------- param extraction ----------

function extractParams(params: any[], content: string, notes: string[]): HookParam[] {
  const out: HookParam[] = [];
  for (const p of params) {
    out.push(paramInfo(p, content, notes));
  }
  return out;
}

function paramInfo(p: any, content: string, notes: string[]): HookParam {
  // RestElement: ...rest: T[]
  if (p.type === 'RestElement') {
    const name = p.argument?.type === 'Identifier' ? p.argument.name : 'rest';
    const type = typeOfNode(p, content) ?? 'any';
    return { name, type, required: false, rest: true };
  }

  // AssignmentPattern: the param has a default value → optional
  if (p.type === 'AssignmentPattern') {
    const inner = paramInfo(p.left, content, notes);
    return { ...inner, required: false };
  }

  // ObjectPattern / ArrayPattern: destructured
  if (p.type === 'ObjectPattern' || p.type === 'ArrayPattern') {
    const name = p.type === 'ObjectPattern' ? 'options' : 'tuple';
    const type = typeOfNode(p, content) ?? 'any';
    const optional = Boolean(p.optional);
    if (!p.typeAnnotation) {
      notes.push(`Destructured parameter has no type annotation`);
    }
    return { name, type, required: !optional, destructured: true };
  }

  // Identifier
  if (p.type === 'Identifier') {
    const type = typeOfNode(p, content) ?? 'any';
    return { name: p.name, type, required: !p.optional };
  }

  notes.push(`Skipped unsupported parameter node (${p.type})`);
  return { name: 'unknown', type: 'any', required: false };
}

function typeOfNode(node: any, content: string): string | null {
  const ann = node.typeAnnotation?.typeAnnotation;
  if (!ann) return null;
  return sliceSource(content, ann);
}

function extractReturnType(fn: any, content: string): string | null {
  const ann = fn?.returnType?.typeAnnotation;
  if (!ann) return null;
  return sliceSource(content, ann);
}

// ---------- helpers ----------

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

function sliceSource(content: string, node: any): string {
  if (typeof node.start === 'number' && typeof node.end === 'number') {
    return content.slice(node.start, node.end).trim();
  }
  return 'any';
}

// ---------- formatting ----------

function formatSignature(r: HookSignatureResult, format: 'text' | 'markdown'): string {
  const lines: string[] = [];
  lines.push(format === 'markdown' ? `# ${r.name} (${r.file})` : `Hook: ${r.name}`);
  if (!r.found) {
    lines.push('Not found.');
    if (r.notes.length) lines.push(...r.notes.map((n) => `  ${n}`));
    return lines.join('\n');
  }

  lines.push(`Kind: ${r.kind ?? 'unknown'}`);
  lines.push(`Return: ${r.returnType ?? '(inferred)'}`);
  lines.push('');

  if (r.parameters.length) {
    lines.push(format === 'markdown' ? '## Parameters' : 'Parameters:');
    for (const p of r.parameters) {
      const tags: string[] = [];
      if (p.destructured) tags.push('destructured');
      if (p.rest) tags.push('rest');
      const suffix = tags.length ? `  [${tags.join(', ')}]` : '';
      lines.push(`  ${p.name}${p.required ? '' : '?'}: ${p.type}${suffix}`);
    }
  } else {
    lines.push('Parameters: (none)');
  }

  if (r.notes.length) {
    lines.push('');
    lines.push(format === 'markdown' ? '## Notes' : 'Notes:');
    for (const n of r.notes) lines.push(`  ${n}`);
  }

  return lines.join('\n');
}
