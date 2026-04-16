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
import {
  readTsconfigPaths,
  resolveImportSource,
  toProjectRelative,
} from './shared/module-resolver.js';

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

  const content = readFileSafe(absFile);
  if (!content.trim()) return notFound('File is empty');

  const ast = safeParse(content, absFile);
  if (!ast) return notFound('File failed to parse');

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

// ---------- component discovery ----------

interface FoundComponent {
  fn: any; // FunctionDeclaration | FunctionExpression | ArrowFunctionExpression | ClassDeclaration
  kind: 'function' | 'arrow' | 'class' | 'unknown';
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
  kind: FoundComponent['kind'],
  absFile: string,
  projectPath: string
): ComponentPropsResult {
  const notes: string[] = [];

  // Inline object type: { a: string; b?: number }
  if (typeNode.type === 'TSTypeLiteral') {
    return buildResult(
      component,
      relFile,
      kind,
      'inline',
      null,
      null,
      extractFromTypeLiteral(typeNode, content, notes),
      notes
    );
  }

  // Named type reference
  if (typeNode.type === 'TSTypeReference' && typeNode.typeName?.type === 'Identifier') {
    const typeName: string = typeNode.typeName.name;
    const local = resolveLocalType(ast, typeName);
    if (local) return localTypeResult(local, typeName, content, relFile, kind, component, notes);

    // Not defined locally — try one-hop imported-type resolution
    const imported = resolveImportedType(ast, typeName, absFile, projectPath);
    if (imported) return importedTypeResult(imported, typeName, kind, component, relFile, notes);

    notes.push(
      `Type "${typeName}" is not defined in this file and its import could not be resolved`
    );
    return emptyResult(component, relFile, kind, 'imported-unresolved', typeName, null, notes);
  }

  notes.push(`Unsupported prop type annotation (${typeNode.type})`);
  return emptyResult(component, relFile, kind, 'unresolved', null, null, notes);
}

function localTypeResult(
  local: LocalTypeMatch,
  typeName: string,
  content: string,
  relFile: string,
  kind: FoundComponent['kind'],
  component: string,
  notes: string[]
): ComponentPropsResult {
  if (local.kind === 'interface') {
    return buildResult(
      component,
      relFile,
      kind,
      'local-interface',
      typeName,
      null,
      extractFromInterfaceBody(local.node, content, notes),
      notes
    );
  }
  if (local.node.typeAnnotation?.type === 'TSTypeLiteral') {
    return buildResult(
      component,
      relFile,
      kind,
      'local-type',
      typeName,
      null,
      extractFromTypeLiteral(local.node.typeAnnotation, content, notes),
      notes
    );
  }
  notes.push(
    `Type "${typeName}" is not a plain object type (likely intersection or mapped type)`
  );
  return emptyResult(component, relFile, kind, 'unresolved', typeName, null, notes);
}

function importedTypeResult(
  imported: ImportedTypeResolution,
  typeName: string,
  kind: FoundComponent['kind'],
  component: string,
  relFile: string,
  notes: string[]
): ComponentPropsResult {
  if (imported.kind === 'interface') {
    return buildResult(
      component,
      relFile,
      kind,
      'imported-interface',
      imported.exportedName,
      imported.file,
      extractFromInterfaceBody(imported.node, imported.content, notes),
      notes
    );
  }
  if (imported.node.typeAnnotation?.type === 'TSTypeLiteral') {
    return buildResult(
      component,
      relFile,
      kind,
      'imported-type',
      imported.exportedName,
      imported.file,
      extractFromTypeLiteral(imported.node.typeAnnotation, imported.content, notes),
      notes
    );
  }
  notes.push(
    `Imported type "${typeName}" resolves to ${imported.file} but is not a plain object type`
  );
  return emptyResult(component, relFile, kind, 'imported-unresolved', typeName, imported.file, notes);
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

// ---------- imported-type resolution (one hop) ----------

interface ImportedTypeResolution {
  kind: 'interface' | 'type';
  node: any;
  content: string;        // source of the target file (for sliceSource)
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
  const content = readFileSafe(targetAbs);
  if (!content.trim()) return null;

  const targetAst = safeParse(content, targetAbs);
  if (!targetAst) return null;

  const local = resolveLocalType(targetAst, lookup.exportedName);
  if (!local) return null;

  return {
    kind: local.kind,
    node: local.node,
    content,
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
