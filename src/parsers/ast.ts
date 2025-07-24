// @ts-nocheck
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import fs from 'fs';

// Handle ES module import issues
const traverseFunction = typeof traverse === 'function' ? traverse : (traverse as any).default;

// Synchronous file reader for AST parsing
function readFileSync(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export interface ParsedAST {
  ast: t.File;
  filePath: string;
  content: string;
}

export function parseFile(filePath: string): ParsedAST | null {
  const content = readFileSync(filePath);
  if (!content) {
    return null;
  }

  try {
    const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
    const isJSX = filePath.endsWith('.jsx') || filePath.endsWith('.tsx') || 
                  content.includes('</') || content.includes('jsx') || 
                  content.includes('React.createElement');

    const ast = parse(content, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      plugins: [
        'decorators-legacy',
        'classProperties',
        'objectRestSpread',
        'asyncGenerators',
        'functionBind',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'dynamicImport',
        'nullishCoalescingOperator',
        'optionalChaining',
        ...(isTypeScript ? ['typescript' as const] : []),
        ...(isJSX ? ['jsx' as const] : [])
      ]
    });

    return {
      ast,
      filePath,
      content
    };
  } catch (error) {
    console.warn(`Failed to parse ${filePath}:`, error);
    return null;
  }
}

export function findImports(ast: t.File): Array<{
  source: string;
  imports: Array<{
    local: string;
    imported?: string;
    isDefault: boolean;
  }>;
}> {
  const imports: Array<{
    source: string;
    imports: Array<{
      local: string;
      imported?: string;
      isDefault: boolean;
    }>;
  }> = [];

  traverseFunction(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value;
      const specifiers = path.node.specifiers.map(spec => {
        if (t.isImportDefaultSpecifier(spec)) {
          return {
            local: spec.local.name,
            isDefault: true
          };
        } else if (t.isImportSpecifier(spec)) {
          return {
            local: spec.local.name,
            imported: t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value,
            isDefault: false
          };
        } else if (t.isImportNamespaceSpecifier(spec)) {
          return {
            local: spec.local.name,
            isDefault: false
          };
        }
        return {
          local: 'unknown',
          isDefault: false
        };
      });

      imports.push({
        source,
        imports: specifiers
      });
    }
  });

  return imports;
}

export function findExports(ast: t.File): Array<{
  name: string;
  isDefault: boolean;
  type: 'function' | 'variable' | 'class' | 'unknown';
}> {
  const exports: Array<{
    name: string;
    isDefault: boolean;
    type: 'function' | 'variable' | 'class' | 'unknown';
  }> = [];

  traverseFunction(ast, {
    ExportDefaultDeclaration(path) {
      let name = 'default';
      let type: 'function' | 'variable' | 'class' | 'unknown' = 'unknown';

      if (t.isIdentifier(path.node.declaration)) {
        name = path.node.declaration.name;
      } else if (t.isFunctionDeclaration(path.node.declaration)) {
        name = path.node.declaration.id?.name || 'default';
        type = 'function';
      } else if (t.isClassDeclaration(path.node.declaration)) {
        name = path.node.declaration.id?.name || 'default';
        type = 'class';
      }

      exports.push({
        name,
        isDefault: true,
        type
      });
    },

    ExportNamedDeclaration(path) {
      if (path.node.declaration) {
        if (t.isFunctionDeclaration(path.node.declaration)) {
          exports.push({
            name: path.node.declaration.id?.name || 'anonymous',
            isDefault: false,
            type: 'function'
          });
        } else if (t.isClassDeclaration(path.node.declaration)) {
          exports.push({
            name: path.node.declaration.id?.name || 'anonymous',
            isDefault: false,
            type: 'class'
          });
        } else if (t.isVariableDeclaration(path.node.declaration)) {
          path.node.declaration.declarations.forEach(declarator => {
            if (t.isIdentifier(declarator.id)) {
              exports.push({
                name: declarator.id.name,
                isDefault: false,
                type: 'variable'
              });
            }
          });
        }
      }

      if (path.node.specifiers) {
        path.node.specifiers.forEach(spec => {
          if (t.isExportSpecifier(spec)) {
            exports.push({
              name: t.isIdentifier(spec.exported) ? spec.exported.name : spec.exported.value,
              isDefault: false,
              type: 'unknown'
            });
          }
        });
      }
    }
  });

  return exports;
}

export function findFunctionDeclarations(ast: t.File): Array<{
  name: string;
  params: string[];
  isAsync: boolean;
  isGenerator: boolean;
  type: 'function' | 'arrow' | 'method';
}> {
  const functions: Array<{
    name: string;
    params: string[];
    isAsync: boolean;
    isGenerator: boolean;
    type: 'function' | 'arrow' | 'method';
  }> = [];

  traverseFunction(ast, {
    FunctionDeclaration(path) {
      functions.push({
        name: path.node.id?.name || 'anonymous',
        params: path.node.params.map(param => {
          if (t.isIdentifier(param)) return param.name;
          if (t.isPattern(param)) return 'pattern';
          return 'unknown';
        }),
        isAsync: path.node.async,
        isGenerator: path.node.generator,
        type: 'function'
      });
    },

    VariableDeclarator(path) {
      if (t.isIdentifier(path.node.id) && (
        t.isArrowFunctionExpression(path.node.init) ||
        t.isFunctionExpression(path.node.init)
      )) {
        const func = path.node.init;
        functions.push({
          name: path.node.id.name,
          params: func.params.map(param => {
            if (t.isIdentifier(param)) return param.name;
            if (t.isPattern(param)) return 'pattern';
            return 'unknown';
          }),
          isAsync: func.async,
          isGenerator: func.generator || false,
          type: t.isArrowFunctionExpression(func) ? 'arrow' : 'function'
        });
      }
    }
  });

  return functions;
}

export function isReactComponent(ast: t.File, functionName: string): boolean {
  let isComponent = false;

  traverseFunction(ast, {
    enter(path) {
      // Check if function returns JSX
      if ((t.isFunctionDeclaration(path.node) && path.node.id?.name === functionName) ||
          (t.isVariableDeclarator(path.node) && t.isIdentifier(path.node.id) && 
           path.node.id.name === functionName)) {
        
        // Check for JSX return statements
        path.traverse({
          ReturnStatement(returnPath) {
            if (returnPath.node.argument && 
                (t.isJSXElement(returnPath.node.argument) || 
                 t.isJSXFragment(returnPath.node.argument))) {
              isComponent = true;
            }
          },
          JSXElement() {
            isComponent = true;
          },
          JSXFragment() {
            isComponent = true;
          }
        });
      }
    }
  });

  return isComponent;
}

export function findJSXElements(ast: t.File): string[] {
  const elements: string[] = [];

  traverseFunction(ast, {
    JSXElement(path) {
      if (t.isJSXIdentifier(path.node.openingElement.name)) {
        elements.push(path.node.openingElement.name.name);
      } else if (t.isJSXMemberExpression(path.node.openingElement.name)) {
        // Handle cases like React.Fragment, motion.div, etc.
        const memberExpr = path.node.openingElement.name;
        if (t.isJSXIdentifier(memberExpr.object) && t.isJSXIdentifier(memberExpr.property)) {
          elements.push(`${memberExpr.object.name}.${memberExpr.property.name}`);
        }
      }
    }
  });

  return [...new Set(elements)]; // Remove duplicates
}
