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
import type { ToolDefinition, ToolContext } from './types.js';
import { createTextResponse, createErrorResponse } from './types.js';
import {
  readTsconfigPaths,
  resolveImportSource,
  toProjectRelative,
} from './shared/module-resolver.js';
import { parseFileCached } from './shared/ast-cache.js';

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
  | 'imported-interface'
  | 'imported-type'
  | 'imported-unresolved'
  | 'composed'
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
  componentKind: 'function' | 'arrow' | 'class' | 'unknown' | null;
  propsTypeSource: PropsTypeSource | null;
  propsTypeName: string | null;
  propsTypeFile: string | null;
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
    propsTypeFile: null,
    props: [],
    notes: [note],
  });

  const parsed = parseFileCached(absFile);
  if (!parsed) return notFound('File failed to parse or is empty');
  const ast = parsed.ast;
  const content = parsed.content;

  const found = findComponent(ast, component);
  if (!found) return notFound(`Component "${component}" not found in ${relFile}`);

  // Class component: extract the generic argument of `extends React.Component<Props>`
  if (found.kind === 'class') {
    const typeArg = classPropsType(found.fn);
    if (!typeArg) {
      return {
        name: component,
        file: relFile,
        found: true,
        componentKind: 'class',
        propsTypeSource: null,
        propsTypeName: null,
        propsTypeFile: null,
        props: [],
        notes: ['Class component has no props type argument on its extends clause'],
      };
    }
    return extractPropsFromType(typeArg, ast, content, relFile, component, 'class', absFile, projectPath);
  }

  // Prefer React.FC<Props> / FC<Props> generic on the variable declarator
  // when present — that's the canonical location for arrow-function components.
  const fcTypeArg = extractFcPropsType(found.varTypeAnnotation);
  if (fcTypeArg) {
    return extractPropsFromType(
      fcTypeArg,
      ast,
      content,
      relFile,
      component,
      found.kind,
      absFile,
      projectPath
    );
  }

  const propsParam = firstParamOf(found.fn);
  if (!propsParam) {
    return {
      name: component,
      file: relFile,
      found: true,
      componentKind: found.kind,
      propsTypeSource: null,
      propsTypeName: null,
      propsTypeFile: null,
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
      propsTypeFile: null,
      props: [],
      notes: ['Props parameter has no type annotation'],
    };
  }

  return extractPropsFromType(
    typeAnnotation,
    ast,
    content,
    relFile,
    component,
    found.kind,
    absFile,
    projectPath
  );
}

const FC_NAMES = new Set([
  'FC',
  'FunctionComponent',
  'VFC',
  'VoidFunctionComponent',
]);

function extractFcPropsType(annotation: any): any | null {
  if (!annotation || annotation.type !== 'TSTypeReference') return null;
  const name = annotation.typeName;
  let tail: string | null = null;
  if (name?.type === 'Identifier') tail = name.name;
  else if (name?.type === 'TSQualifiedName' && name.right?.type === 'Identifier')
    tail = name.right.name;
  if (!tail || !FC_NAMES.has(tail)) return null;
  const params = annotation.typeParameters?.params;
  if (!params?.length) return null;
  return params[0];
}

// ---------- component discovery ----------

interface FoundComponent {
  fn: any; // FunctionDeclaration | FunctionExpression | ArrowFunctionExpression | ClassDeclaration
  kind: 'function' | 'arrow' | 'class' | 'unknown';
  /** Type annotation on the variable declarator, when `const X: React.FC<Props> = ...`. */
  varTypeAnnotation?: any;
}

function findComponent(ast: any, name: string): FoundComponent | null {
  for (const node of ast.program.body) {
    // function Button(...) {}
    if (node.type === 'FunctionDeclaration' && node.id?.name === name) {
      return { fn: node, kind: 'function' };
    }
    // class Button extends React.Component {}
    if (node.type === 'ClassDeclaration' && node.id?.name === name) {
      return { fn: node, kind: 'class' };
    }
    if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id?.name === name) {
        return { fn: node.declaration, kind: 'function' };
      }
      if (node.declaration.type === 'ClassDeclaration' && node.declaration.id?.name === name) {
        return { fn: node.declaration, kind: 'class' };
      }
      if (node.declaration.type === 'VariableDeclaration') {
        const match = findComponentInVariableDecl(node.declaration, name);
        if (match) return match;
      }
    }
    if (node.type === 'ExportDefaultDeclaration' && node.declaration) {
      if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id?.name === name) {
        return { fn: node.declaration, kind: 'function' };
      }
      if (node.declaration.type === 'ClassDeclaration' && node.declaration.id?.name === name) {
        return { fn: node.declaration, kind: 'class' };
      }
    }
    // const Button = (props: Props) => {}
    if (node.type === 'VariableDeclaration') {
      const match = findComponentInVariableDecl(node, name);
      if (match) return match;
    }
  }
  return null;
}

/**
 * For `class Foo extends React.Component<Props> {}`, return the `Props` node.
 * Handles bare identifiers and MemberExpressions as the superclass, and both
 * `superTypeParameters` (classic babel) and `superTypeArguments` (newer babel).
 */
function classPropsType(classNode: any): any | null {
  if (!classNode?.superClass) return null;
  const typeParams =
    classNode.superTypeParameters ?? classNode.superTypeArguments ?? null;
  if (!typeParams || !typeParams.params?.length) return null;
  return typeParams.params[0];
}

function findComponentInVariableDecl(node: any, name: string): FoundComponent | null {
  for (const decl of node.declarations) {
    if (decl.id?.type !== 'Identifier' || decl.id.name !== name) continue;
    const init = decl.init;
    if (!init) continue;
    const varTypeAnnotation = decl.id?.typeAnnotation?.typeAnnotation;
    if (init.type === 'ArrowFunctionExpression') return { fn: init, kind: 'arrow', varTypeAnnotation };
    if (init.type === 'FunctionExpression') return { fn: init, kind: 'function', varTypeAnnotation };
  }
  return null;
}

function firstParamOf(fn: any): any | null {
  return fn?.params?.[0] ?? null;
}

// ---------- type → props ----------

interface FileCtx {
  ast: any;
  content: string;
  absFile: string;
}

interface ResolveCtx {
  projectPath: string;
  /** Guards against cycles; keys are `absFile|typeName`. */
  visited: Set<string>;
}

function extractPropsFromType(
  typeNode: any,
  ast: any,
  content: string,
  relFile: string,
  component: string,
  kind: FoundComponent['kind'],
  absFile: string,
  projectPath: string
): ComponentPropsResult {
  const notes: string[] = [];
  const file: FileCtx = { ast, content, absFile };
  const ctx: ResolveCtx = { projectPath, visited: new Set() };

  // Inline object type: { a: string; b?: number }
  if (typeNode.type === 'TSTypeLiteral') {
    const members = resolveTypeToMembers(typeNode, file, ctx, notes);
    return buildResult(component, relFile, kind, 'inline', null, null, toProps(members), notes);
  }

  // Top-level intersection — unnamed composition
  if (typeNode.type === 'TSIntersectionType') {
    const members = resolveTypeToMembers(typeNode, file, ctx, notes);
    return buildResult(component, relFile, kind, 'composed', null, null, toProps(members), notes);
  }

  // Named type reference — Props, Omit<P, K>, Partial<P>, etc.
  if (typeNode.type === 'TSTypeReference' && typeNode.typeName?.type === 'Identifier') {
    const typeName: string = typeNode.typeName.name;

    if (isUtilityType(typeName)) {
      const members = resolveTypeToMembers(typeNode, file, ctx, notes);
      return buildResult(component, relFile, kind, 'composed', typeName, null, toProps(members), notes);
    }

    const local = resolveLocalType(ast, typeName);
    if (local) {
      const members = membersFromLocalType(local, file, ctx, notes);
      const source: PropsTypeSource = local.kind === 'interface' ? 'local-interface' : 'local-type';
      return buildResult(component, relFile, kind, source, typeName, null, toProps(members), notes);
    }

    const imported = resolveImportedType(ast, typeName, absFile, projectPath);
    if (imported) {
      const targetAbs = path.resolve(projectPath, imported.file);
      const targetParsed = parseFileCached(targetAbs);
      const targetFile: FileCtx = {
        ast: targetParsed?.ast ?? null,
        content: targetParsed?.content ?? '',
        absFile: targetAbs,
      };
      const members = membersFromLocalType(
        { kind: imported.kind, node: imported.node },
        targetFile,
        ctx,
        notes
      );
      const source: PropsTypeSource =
        imported.kind === 'interface' ? 'imported-interface' : 'imported-type';
      return buildResult(
        component,
        relFile,
        kind,
        source,
        imported.exportedName,
        imported.file,
        toProps(members),
        notes
      );
    }

    notes.push(
      `Type "${typeName}" is not defined in this file and its import could not be resolved`
    );
    return emptyResult(component, relFile, kind, 'imported-unresolved', typeName, null, notes);
  }

  notes.push(`Unsupported prop type annotation (${typeNode.type})`);
  return emptyResult(component, relFile, kind, 'unresolved', null, null, notes);
}

function buildResult(
  component: string,
  file: string,
  kind: FoundComponent['kind'],
  source: PropsTypeSource,
  typeName: string | null,
  typeFile: string | null,
  props: PropInfo[],
  notes: string[]
): ComponentPropsResult {
  return {
    name: component,
    file,
    found: true,
    componentKind: kind,
    propsTypeSource: source,
    propsTypeName: typeName,
    propsTypeFile: typeFile,
    props,
    notes,
  };
}

function emptyResult(
  component: string,
  file: string,
  kind: FoundComponent['kind'],
  source: PropsTypeSource,
  typeName: string | null,
  typeFile: string | null,
  notes: string[]
): ComponentPropsResult {
  return buildResult(component, file, kind, source, typeName, typeFile, [], notes);
}

// ---------- core resolver (produces a members map) ----------

/**
 * Resolve a type node to a map of prop-name → PropInfo. Handles intersections,
 * utility types (Omit / Pick / Partial / Required), interface extends chains,
 * and one-hop imported types. On any branch we can't resolve, we push a note
 * and return what we could — partial beats silent failure.
 */
function resolveTypeToMembers(
  typeNode: any,
  file: FileCtx,
  ctx: ResolveCtx,
  notes: string[]
): Map<string, PropInfo> {
  const out = new Map<string, PropInfo>();
  if (!typeNode) return out;

  if (typeNode.type === 'TSTypeLiteral') {
    mergeInto(out, membersFromList(typeNode.members ?? [], file.content, notes));
    return out;
  }

  if (typeNode.type === 'TSIntersectionType') {
    for (const branch of typeNode.types ?? []) {
      mergeInto(out, resolveTypeToMembers(branch, file, ctx, notes));
    }
    return out;
  }

  if (typeNode.type === 'TSTypeReference' && typeNode.typeName?.type === 'Identifier') {
    const typeName: string = typeNode.typeName.name;

    if (isUtilityType(typeName)) {
      mergeInto(out, applyUtilityType(typeNode, file, ctx, notes));
      return out;
    }

    const visitKey = file.absFile + '|' + typeName;
    if (ctx.visited.has(visitKey)) {
      notes.push(`Circular type reference "${typeName}"`);
      return out;
    }
    ctx.visited.add(visitKey);

    const local = resolveLocalType(file.ast, typeName);
    if (local) {
      mergeInto(out, membersFromLocalType(local, file, ctx, notes));
      return out;
    }

    const imported = resolveImportedType(file.ast, typeName, file.absFile, ctx.projectPath);
    if (imported) {
      const targetAbs = path.resolve(ctx.projectPath, imported.file);
      const targetParsed = parseFileCached(targetAbs);
      const targetFile: FileCtx = {
        ast: targetParsed?.ast ?? null,
        content: targetParsed?.content ?? '',
        absFile: targetAbs,
      };
      mergeInto(
        out,
        membersFromLocalType({ kind: imported.kind, node: imported.node }, targetFile, ctx, notes)
      );
      return out;
    }

    notes.push(`Type "${typeName}" could not be resolved`);
    return out;
  }

  notes.push(`Unsupported type node (${typeNode.type})`);
  return out;
}

function membersFromLocalType(
  local: LocalTypeMatch,
  file: FileCtx,
  ctx: ResolveCtx,
  notes: string[]
): Map<string, PropInfo> {
  if (local.kind === 'interface') {
    const out = new Map<string, PropInfo>();
    const extendsList: any[] = local.node.extends ?? [];
    for (const clause of extendsList) {
      const synth = extendsClauseAsTypeRef(clause);
      if (synth) {
        mergeInto(out, resolveTypeToMembers(synth, file, ctx, notes));
      } else {
        notes.push('Unsupported extends clause');
      }
    }
    mergeInto(out, membersFromList(local.node.body?.body ?? [], file.content, notes));
    return out;
  }
  // type alias — recurse into its annotation within the same file.
  const annotation = local.node.typeAnnotation;
  return resolveTypeToMembers(annotation, file, ctx, notes);
}

/**
 * Rewrite an `interface X extends Base<T>` clause as a synthetic TSTypeReference
 * so resolveTypeToMembers can handle it uniformly with plain references.
 */
function extendsClauseAsTypeRef(clause: any): any | null {
  const expr = clause?.expression;
  if (!expr) return null;
  // `interface X extends Base` — expression is Identifier
  if (expr.type === 'Identifier') {
    return {
      type: 'TSTypeReference',
      typeName: { type: 'Identifier', name: expr.name },
      typeParameters: clause.typeParameters ?? null,
    };
  }
  return null;
}

// ---------- utility types ----------

const UTILITY_TYPES = new Set(['Omit', 'Pick', 'Partial', 'Required']);

function isUtilityType(name: string): boolean {
  return UTILITY_TYPES.has(name);
}

function applyUtilityType(
  typeRef: any,
  file: FileCtx,
  ctx: ResolveCtx,
  notes: string[]
): Map<string, PropInfo> {
  const name: string = typeRef.typeName.name;
  const params = typeRef.typeParameters?.params ?? [];
  if (!params.length) {
    notes.push(`${name}<> missing type arguments`);
    return new Map();
  }
  const base = resolveTypeToMembers(params[0], file, ctx, notes);

  if (name === 'Partial') return mapValues(base, (p) => ({ ...p, required: false }));
  if (name === 'Required') return mapValues(base, (p) => ({ ...p, required: true }));

  // Omit / Pick need the key list
  if (params.length < 2) {
    notes.push(`${name}<T, K> missing K type argument`);
    return name === 'Pick' ? new Map() : base;
  }
  const keys = extractLiteralKeys(params[1]);
  if (!keys) {
    notes.push(`${name}<T, K> key argument is not a string-literal union`);
    return name === 'Pick' ? new Map() : base;
  }
  const keySet = new Set(keys);
  const result = new Map<string, PropInfo>();
  for (const [k, v] of base) {
    if (name === 'Omit' && keySet.has(k)) continue;
    if (name === 'Pick' && !keySet.has(k)) continue;
    result.set(k, v);
  }
  return result;
}

function extractLiteralKeys(node: any): string[] | null {
  if (!node) return null;
  if (node.type === 'TSLiteralType' && node.literal?.type === 'StringLiteral') {
    return [node.literal.value];
  }
  if (node.type === 'TSUnionType') {
    const keys: string[] = [];
    for (const t of node.types ?? []) {
      const k = extractLiteralKeys(t);
      if (!k) return null;
      keys.push(...k);
    }
    return keys;
  }
  return null;
}

// ---------- member list / map helpers ----------

function membersFromList(
  members: any[],
  content: string,
  notes: string[]
): Map<string, PropInfo> {
  const out = new Map<string, PropInfo>();
  for (const m of members) {
    if (m.type !== 'TSPropertySignature') {
      notes.push(`Skipped ${m.type} member`);
      continue;
    }
    const name = nameOfKey(m.key);
    if (!name) continue;
    const annotation = m.typeAnnotation?.typeAnnotation;
    const type = annotation ? sliceSource(content, annotation) : 'any';
    out.set(name, { name, type, required: !m.optional });
  }
  return out;
}

function mergeInto(target: Map<string, PropInfo>, source: Map<string, PropInfo>): void {
  for (const [k, v] of source) target.set(k, v);
}

function mapValues(
  m: Map<string, PropInfo>,
  f: (p: PropInfo) => PropInfo
): Map<string, PropInfo> {
  const out = new Map<string, PropInfo>();
  for (const [k, v] of m) out.set(k, f(v));
  return out;
}

function toProps(m: Map<string, PropInfo>): PropInfo[] {
  return Array.from(m.values());
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

// ---------- imported-type resolution (one hop) ----------

interface ImportedTypeResolution {
  kind: 'interface' | 'type';
  node: any;
  file: string;            // project-relative path to the target
  exportedName: string;    // name the target file exports
}

function resolveImportedType(
  sourceAst: any,
  localName: string,
  fromAbsFile: string,
  projectPath: string
): ImportedTypeResolution | null {
  const lookup = findImportLookup(sourceAst, localName);
  if (!lookup) return null;

  const aliases = readTsconfigPaths(projectPath);
  const resolved = resolveImportSource(lookup.source, fromAbsFile, projectPath, aliases);
  if (!resolved) return null;

  const targetAbs = path.resolve(projectPath, resolved);
  const targetParsed = parseFileCached(targetAbs);
  if (!targetParsed) return null;

  const local = resolveLocalType(targetParsed.ast, lookup.exportedName);
  if (!local) return null;

  return {
    kind: local.kind,
    node: local.node,
    file: resolved,
    exportedName: lookup.exportedName,
  };
}

interface ImportLookup {
  source: string;
  exportedName: string; // the name the target file exports (post rename)
}

/**
 * Find an import in `ast` whose local name is `localName` and return what
 * it was originally exported as from the source module.
 */
function findImportLookup(ast: any, localName: string): ImportLookup | null {
  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration') continue;
    for (const spec of node.specifiers ?? []) {
      if (spec.type === 'ImportSpecifier' && spec.local?.name === localName) {
        const imported =
          spec.imported?.type === 'Identifier'
            ? spec.imported.name
            : spec.imported?.value ?? localName;
        return { source: node.source.value, exportedName: imported };
      }
      // Default and namespace imports for types are rare; skip for MVP.
    }
  }
  return null;
}

// ---------- helpers ----------

function resolveInputPath(projectPath: string, fileArg: string): string {
  if (path.isAbsolute(fileArg)) return fileArg;
  return path.resolve(projectPath, fileArg);
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

  const typeLabel = r.propsTypeName
    ? r.propsTypeName + (r.propsTypeFile ? ` from ${r.propsTypeFile}` : '')
    : '';
  lines.push(`Kind: ${r.componentKind ?? 'unknown'}`);
  lines.push(
    `Props type: ${r.propsTypeSource ?? 'none'}${typeLabel ? ' (' + typeLabel + ')' : ''}`
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
