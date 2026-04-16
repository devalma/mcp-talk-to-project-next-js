/**
 * Get Component Props Tool
 *
 * For a named React component in a given file, extracts its prop surface:
 * prop names, types (as source text), required vs optional, and the source
 * kind (inline type, local interface, local type alias, or imported).
 *
 * Supports common patterns:
 *   - function Button(props: Props) {}
 *   - function Button({ label, onClick }: Props) {}
 *   - function Button(props: { label: string }) {}              // inline
 *   - const Button = (props: Props) => {}
 *   - const Button: React.FC<Props> = (props) => {}              // generic
 *   - export default function Button(props: Props) {}
 *
 * Types that can be resolved in-file:
 *   - interface Props { … }
 *   - type Props = { … }
 * External types (imports, generics, intersections, extends) are reported
 * with the reason rather than silently giving wrong results — the LLM
 * can then open the source file for those specifically.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import type { ToolDefinition, ToolContext } from './types.js';
import { createTextResponse, createErrorResponse } from './types.js';

const ArgsSchema = z.object({
  component: z.string().min(1),
  file: z.string(),
  format: z.enum(['text', 'markdown', 'json']).default('json').optional(),
});

type Args = z.infer<typeof ArgsSchema>;

export type PropsTypeSource =
  | 'inline'
  | 'local-interface'
  | 'local-type'
  | 'imported'
  | 'unresolved';

export interface PropInfo {
  name: string;
  type: string;
  required: boolean;
}

export interface ComponentPropsResult {
  name: string;
  file: string;
  found: boolean;
  componentKind: 'function' | 'arrow' | 'unknown' | null;
  propsTypeSource: PropsTypeSource | null;
  propsTypeName: string | null;
  props: PropInfo[];
  notes: string[];
}

export const getComponentPropsTool: ToolDefinition = {
  definition: {
    name: 'get_component_props',
    description:
      'Extract the prop surface of a named React component in a given file: prop names, types (as TS source text), and required/optional. Handles same-file interface / type alias / inline object types. For imports, generics, or intersections, reports the limitation so the LLM can follow up.',
    inputSchema: {
      type: 'object',
      properties: {
        component: {
          type: 'string',
          description: 'The component name (e.g. "Button").',
        },
        file: {
          type: 'string',
          description: 'The file that defines the component (project-relative or absolute).',
        },
        format: {
          type: 'string',
          enum: ['text', 'markdown', 'json'],
          default: 'json',
        },
      },
      required: ['component', 'file'],
    },
  } as Tool,

  handler: async (args: Args, context: ToolContext) => {
    try {
      const { component, file: fileArg, format = 'json' } = ArgsSchema.parse(args);
      const result = getComponentProps(context.resolvedProjectPath, component, fileArg);

      if (format === 'json') {
        return createTextResponse(JSON.stringify(result, null, 2));
      }
      return createTextResponse(formatProps(result, format));
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.issues
          .map((i) => i.path.join('.') + ': ' + i.message)
          .join(', ');
        return createErrorResponse('Invalid arguments: ' + details);
      }
      const message = error instanceof Error ? error.message : String(error);
      return createErrorResponse(`get_component_props failed: ${message}`);
    }
  },
};

// ---------- core ----------

export function getComponentProps(
  projectPath: string,
  component: string,
  fileArg: string
): ComponentPropsResult {
  const absFile = resolveInputPath(projectPath, fileArg);
  if (!fs.existsSync(absFile)) throw new Error(`File not found: ${fileArg}`);
  const relFile = toProjectRelative(absFile, projectPath);

  const notFound = (note: string): ComponentPropsResult => ({
    name: component,
    file: relFile,
    found: false,
    componentKind: null,
    propsTypeSource: null,
    propsTypeName: null,
    props: [],
    notes: [note],
  });

  const content = readFileSafe(absFile);
  if (!content.trim()) return notFound('File is empty');

  const ast = safeParse(content, absFile);
  if (!ast) return notFound('File failed to parse');

  const found = findComponent(ast, component);
  if (!found) return notFound(`Component "${component}" not found in ${relFile}`);

  const propsParam = firstParamOf(found.fn);
  if (!propsParam) {
    return {
      name: component,
      file: relFile,
      found: true,
      componentKind: found.kind,
      propsTypeSource: null,
      propsTypeName: null,
      props: [],
      notes: ['Component takes no parameter'],
    };
  }

  const typeAnnotation = (propsParam as any).typeAnnotation?.typeAnnotation;
  if (!typeAnnotation) {
    return {
      name: component,
      file: relFile,
      found: true,
      componentKind: found.kind,
      propsTypeSource: null,
      propsTypeName: null,
      props: [],
      notes: ['Props parameter has no type annotation'],
    };
  }

  return extractPropsFromType(typeAnnotation, ast, content, relFile, component, found.kind);
}

// ---------- component discovery ----------

interface FoundComponent {
  fn: any; // FunctionDeclaration | FunctionExpression | ArrowFunctionExpression
  kind: 'function' | 'arrow' | 'unknown';
}

function findComponent(ast: any, name: string): FoundComponent | null {
  for (const node of ast.program.body) {
    // function Button(...) {}
    if (node.type === 'FunctionDeclaration' && node.id?.name === name) {
      return { fn: node, kind: 'function' };
    }
    // export function Button(...) {}
    if (node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'FunctionDeclaration' && node.declaration.id?.name === name) {
      return { fn: node.declaration, kind: 'function' };
    }
    // export default function Button(...) {}
    if (node.type === 'ExportDefaultDeclaration' && node.declaration?.type === 'FunctionDeclaration' && node.declaration.id?.name === name) {
      return { fn: node.declaration, kind: 'function' };
    }
    // const Button = (props: Props) => {}   /   const Button = function(props: Props) {}
    if (node.type === 'VariableDeclaration') {
      const match = findComponentInVariableDecl(node, name);
      if (match) return match;
    }
    // export const Button = ...
    if (node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'VariableDeclaration') {
      const match = findComponentInVariableDecl(node.declaration, name);
      if (match) return match;
    }
  }
  return null;
}

function findComponentInVariableDecl(node: any, name: string): FoundComponent | null {
  for (const decl of node.declarations) {
    if (decl.id?.type !== 'Identifier' || decl.id.name !== name) continue;
    const init = decl.init;
    if (!init) continue;
    if (init.type === 'ArrowFunctionExpression') return { fn: init, kind: 'arrow' };
    if (init.type === 'FunctionExpression') return { fn: init, kind: 'function' };
  }
  return null;
}

function firstParamOf(fn: any): any | null {
  return fn?.params?.[0] ?? null;
}

// ---------- type → props ----------

function extractPropsFromType(
  typeNode: any,
  ast: any,
  content: string,
  relFile: string,
  component: string,
  kind: FoundComponent['kind']
): ComponentPropsResult {
  const notes: string[] = [];

  // Inline object type: { a: string; b?: number }
  if (typeNode.type === 'TSTypeLiteral') {
    return {
      name: component,
      file: relFile,
      found: true,
      componentKind: kind,
      propsTypeSource: 'inline',
      propsTypeName: null,
      props: extractFromTypeLiteral(typeNode, content, notes),
      notes,
    };
  }

  // Named type reference
  if (typeNode.type === 'TSTypeReference' && typeNode.typeName?.type === 'Identifier') {
    const typeName: string = typeNode.typeName.name;
    const resolved = resolveLocalType(ast, typeName);

    if (resolved?.kind === 'interface') {
      return {
        name: component,
        file: relFile,
        found: true,
        componentKind: kind,
        propsTypeSource: 'local-interface',
        propsTypeName: typeName,
        props: extractFromInterfaceBody(resolved.node, content, notes),
        notes,
      };
    }

    if (resolved?.kind === 'type' && resolved.node.typeAnnotation?.type === 'TSTypeLiteral') {
      return {
        name: component,
        file: relFile,
        found: true,
        componentKind: kind,
        propsTypeSource: 'local-type',
        propsTypeName: typeName,
        props: extractFromTypeLiteral(resolved.node.typeAnnotation, content, notes),
        notes,
      };
    }

    if (resolved?.kind === 'type') {
      notes.push(
        `Type "${typeName}" is not a plain object type (likely intersection or mapped type)`
      );
      return emptyResult(component, relFile, kind, 'unresolved', typeName, notes);
    }

    // Not defined locally → probably imported
    notes.push(
      `Type "${typeName}" is not defined in this file — likely imported from another module`
    );
    return emptyResult(component, relFile, kind, 'imported', typeName, notes);
  }

  notes.push(`Unsupported prop type annotation (${typeNode.type})`);
  return emptyResult(component, relFile, kind, 'unresolved', null, notes);
}

function emptyResult(
  component: string,
  file: string,
  kind: FoundComponent['kind'],
  source: PropsTypeSource,
  typeName: string | null,
  notes: string[]
): ComponentPropsResult {
  return {
    name: component,
    file,
    found: true,
    componentKind: kind,
    propsTypeSource: source,
    propsTypeName: typeName,
    props: [],
    notes,
  };
}

function extractFromTypeLiteral(
  typeLit: any,
  content: string,
  notes: string[]
): PropInfo[] {
  return extractMembers(typeLit.members ?? [], content, notes);
}

function extractFromInterfaceBody(iface: any, content: string, notes: string[]): PropInfo[] {
  return extractMembers(iface.body?.body ?? [], content, notes);
}

function extractMembers(members: any[], content: string, notes: string[]): PropInfo[] {
  const props: PropInfo[] = [];
  for (const m of members) {
    if (m.type !== 'TSPropertySignature') {
      notes.push(`Skipped ${m.type} member`);
      continue;
    }
    const name = nameOfKey(m.key);
    if (!name) continue;
    const annotation = m.typeAnnotation?.typeAnnotation;
    const type = annotation ? sliceSource(content, annotation) : 'any';
    props.push({
      name,
      type,
      required: !m.optional,
    });
  }
  return props;
}

function nameOfKey(key: any): string | null {
  if (!key) return null;
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'StringLiteral') return key.value;
  return null;
}

function sliceSource(content: string, node: any): string {
  if (typeof node.start === 'number' && typeof node.end === 'number') {
    return content.slice(node.start, node.end).trim();
  }
  return 'any';
}

// ---------- local type resolution ----------

interface LocalTypeMatch {
  kind: 'interface' | 'type';
  node: any;
}

function resolveLocalType(ast: any, name: string): LocalTypeMatch | null {
  for (const node of ast.program.body) {
    const match = matchLocalType(node, name);
    if (match) return match;
    if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      const m = matchLocalType(node.declaration, name);
      if (m) return m;
    }
  }
  return null;
}

function matchLocalType(node: any, name: string): LocalTypeMatch | null {
  if (node.type === 'TSInterfaceDeclaration' && node.id?.name === name) {
    return { kind: 'interface', node };
  }
  if (node.type === 'TSTypeAliasDeclaration' && node.id?.name === name) {
    return { kind: 'type', node };
  }
  return null;
}

// ---------- helpers ----------

function resolveInputPath(projectPath: string, fileArg: string): string {
  if (path.isAbsolute(fileArg)) return fileArg;
  return path.resolve(projectPath, fileArg);
}

function toProjectRelative(absPath: string, projectPath: string): string {
  return path.relative(projectPath, absPath).replace(/\\/g, '/');
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

// ---------- formatting ----------

function formatProps(r: ComponentPropsResult, format: 'text' | 'markdown'): string {
  const lines: string[] = [];
  lines.push(format === 'markdown' ? `# ${r.name} (${r.file})` : `Component: ${r.name}`);
  if (!r.found) {
    lines.push('Not found.');
    if (r.notes.length) lines.push(...r.notes.map((n) => `  ${n}`));
    return lines.join('\n');
  }

  lines.push(`Kind: ${r.componentKind ?? 'unknown'}`);
  lines.push(
    `Props type: ${r.propsTypeSource ?? 'none'}${r.propsTypeName ? ' (' + r.propsTypeName + ')' : ''}`
  );
  lines.push('');

  if (r.props.length) {
    lines.push(format === 'markdown' ? '## Props' : 'Props:');
    for (const p of r.props) {
      lines.push(`  ${p.name}${p.required ? '' : '?'}: ${p.type}`);
    }
  } else {
    lines.push('Props: (none resolved)');
  }

  if (r.notes.length) {
    lines.push('');
    lines.push(format === 'markdown' ? '## Notes' : 'Notes:');
    for (const n of r.notes) lines.push(`  ${n}`);
  }

  return lines.join('\n');
}
