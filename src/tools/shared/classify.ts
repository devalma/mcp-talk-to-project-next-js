/**
 * Shared symbol-classification heuristics.
 *
 * Used by find_symbol, get_file_exports, and anywhere else that needs to
 * label a declaration as component / hook / function / class.
 *
 * The rules:
 *   - name matches /^use[A-Z]/  → hook
 *   - name is PascalCase AND body contains JSX  → component
 *   - class extends React.Component | PureComponent  → component
 *   - everything else falls back to the declaration's type
 */

export type FunctionKind = 'component' | 'hook' | 'function';

export function classifyFunctionKind(name: string, fn: any): FunctionKind {
  if (/^use[A-Z]/.test(name)) return 'hook';
  if (isPascalCase(name) && functionReturnsJsx(fn)) return 'component';
  return 'function';
}

export function isPascalCase(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

export function functionReturnsJsx(fn: any): boolean {
  if (!fn) return false;
  // Arrow with implicit JSX return: const Foo = () => <div />
  if (fn.type === 'ArrowFunctionExpression' && isJsxNode(fn.body)) return true;
  const body = fn.body;
  if (!body || body.type !== 'BlockStatement') return false;

  let found = false;
  function walk(n: any): void {
    if (found || !n || typeof n !== 'object') return;
    if (isJsxNode(n)) {
      found = true;
      return;
    }
    // Don't descend into nested function declarations — their JSX doesn't
    // reflect on the outer function.
    if (
      n.type === 'FunctionDeclaration' ||
      n.type === 'FunctionExpression' ||
      n.type === 'ArrowFunctionExpression'
    ) {
      return;
    }
    for (const key in n) {
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      const v = (n as any)[key];
      if (Array.isArray(v)) for (const c of v) walk(c);
      else if (v && typeof v === 'object') walk(v);
    }
  }

  for (const stmt of body.body) walk(stmt);
  return found;
}

export function isJsxNode(n: any): boolean {
  return n?.type === 'JSXElement' || n?.type === 'JSXFragment';
}

export function extendsReactComponent(classNode: any): boolean {
  const sup = classNode?.superClass;
  if (!sup) return false;
  if (sup.type === 'Identifier') {
    return sup.name === 'Component' || sup.name === 'PureComponent';
  }
  if (sup.type === 'MemberExpression' && sup.property?.type === 'Identifier') {
    return sup.property.name === 'Component' || sup.property.name === 'PureComponent';
  }
  return false;
}
