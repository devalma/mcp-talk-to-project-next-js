/**
 * Common AST Utilities - Shared AST parsing and traversal for all plugins
 */

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { FileUtils } from './file-utils.js';

// Handle ES module import issues
const traverseFunction = typeof traverse === 'function' ? traverse : (traverse as any).default;

/**
 * AST utilities that all plugins can use
 */
export class ASTUtils {
  /**
   * Parse a file into an AST
   */
  static async parseFile(filePath: string): Promise<any | null> {
    try {
      const content = await FileUtils.readFile(filePath);
      if (!content || content.trim() === '') {
        // Don't log warnings for empty files as they're common placeholders
        return null;
      }

      return ASTUtils.parseCode(content, filePath);
    } catch (error) {
      console.warn(`Failed to parse file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Parse code string into AST
   */
  static parseCode(code: string, filePath?: string): any {
    const isTypeScript = filePath?.endsWith('.ts') || filePath?.endsWith('.tsx');
    // Enable JSX for all JS files in case they contain React components
    const isJSX = filePath?.endsWith('.jsx') || filePath?.endsWith('.tsx') || filePath?.endsWith('.js');

    return parse(code, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      plugins: ([
        'asyncGenerators',
        'bigInt',
        'classProperties',
        'decorators-legacy',
        'doExpressions',
        'dynamicImport',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'functionBind',
        'functionSent',
        'importMeta',
        'nullishCoalescingOperator',
        'numericSeparator',
        'objectRestSpread',
        'optionalCatchBinding',
        'optionalChaining',
        'throwExpressions',
        'topLevelAwait',
        'trailingFunctionCommas',
        ...(isTypeScript ? ['typescript'] : []),
        ...(isJSX ? ['jsx'] : [])
      ] as any)
    });
  }

  /**
   * Traverse AST with visitor pattern
   */
  static traverse(ast: any, visitor: any): void {
    if (!ast || typeof ast !== 'object') {
      console.warn('ASTUtils.traverse: Invalid AST provided');
      return;
    }
    
    try {
      traverseFunction(ast, visitor);
    } catch (error: any) {
      console.warn('ASTUtils.traverse: Error during traversal:', error.message);
    }
  }

  /**
   * Find all imports in an AST
   */
  static findImports(ast: any): ImportInfo[] {
    const imports: ImportInfo[] = [];
    
    ASTUtils.traverse(ast, {
      ImportDeclaration(path: any) {
        const { node } = path;
        const importInfo: ImportInfo = {
          source: node.source.value,
          imports: [],
          isDefault: false,
          isNamespace: false
        };

        for (const specifier of node.specifiers) {
          if (t.isImportDefaultSpecifier(specifier)) {
            importInfo.isDefault = true;
            importInfo.imports.push({
              imported: 'default',
              local: specifier.local.name
            });
          } else if (t.isImportNamespaceSpecifier(specifier)) {
            importInfo.isNamespace = true;
            importInfo.imports.push({
              imported: '*',
              local: specifier.local.name
            });
          } else if (t.isImportSpecifier(specifier)) {
            importInfo.imports.push({
              imported: t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value,
              local: specifier.local.name
            });
          }
        }

        imports.push(importInfo);
      }
    });

    return imports;
  }

  /**
   * Find all exports in an AST
   */
  static findExports(ast: any): ExportInfo[] {
    const exports: ExportInfo[] = [];
    
    ASTUtils.traverse(ast, {
      ExportDefaultDeclaration(path: any) {
        const { node } = path;
        let name = 'default';
        
        if (t.isIdentifier(node.declaration)) {
          name = node.declaration.name;
        } else if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
          name = node.declaration.id.name;
        } else if (t.isClassDeclaration(node.declaration) && node.declaration.id) {
          name = node.declaration.id.name;
        }

        exports.push({
          name,
          type: 'default'
        });
      },

      ExportNamedDeclaration(path: any) {
        const { node } = path;
        
        if (node.declaration) {
          if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
            exports.push({
              name: node.declaration.id.name,
              type: 'named'
            });
          } else if (t.isClassDeclaration(node.declaration) && node.declaration.id) {
            exports.push({
              name: node.declaration.id.name,
              type: 'named'
            });
          } else if (t.isVariableDeclaration(node.declaration)) {
            for (const declarator of node.declaration.declarations) {
              if (t.isIdentifier(declarator.id)) {
                exports.push({
                  name: declarator.id.name,
                  type: 'named'
                });
              }
            }
          }
        }

        if (node.specifiers) {
          for (const specifier of node.specifiers) {
            if (t.isExportSpecifier(specifier)) {
              exports.push({
                name: t.isIdentifier(specifier.exported) ? specifier.exported.name : specifier.exported.value,
                type: 'named',
                source: node.source?.value
              });
            }
          }
        }
      },

      ExportAllDeclaration(path: any) {
        const { node } = path;
        exports.push({
          name: '*',
          type: 'namespace',
          source: node.source.value
        });
      }
    });

    return exports;
  }

  /**
   * Check if a function/component returns JSX
   */
  static containsJSX(nodePath: any): boolean {
    let hasJSX = false;
    
    nodePath.traverse({
      JSXElement() {
        hasJSX = true;
      },
      JSXFragment() {
        hasJSX = true;
      }
    });
    
    return hasJSX;
  }

  /**
   * Get all function calls in AST
   */
  static findFunctionCalls(ast: any, functionName?: string): FunctionCall[] {
    const calls: FunctionCall[] = [];
    
    ASTUtils.traverse(ast, {
      CallExpression(path: any) {
        const { node } = path;
        let name = '';
        
        if (t.isIdentifier(node.callee)) {
          name = node.callee.name;
        } else if (t.isMemberExpression(node.callee)) {
          if (t.isIdentifier(node.callee.property)) {
            name = node.callee.property.name;
          }
        }

        if (!functionName || name === functionName) {
          calls.push({
            name,
            arguments: node.arguments.length,
            line: node.loc?.start.line || 0
          });
        }
      }
    });

    return calls;
  }

  /**
   * Calculate cyclomatic complexity
   */
  static calculateComplexity(nodePath: any): number {
    let complexity = 1; // Base complexity
    
    nodePath.traverse({
      IfStatement() { complexity++; },
      ConditionalExpression() { complexity++; },
      LogicalExpression(path: any) {
        if (path.node.operator === '&&' || path.node.operator === '||') {
          complexity++;
        }
      },
      SwitchCase() { complexity++; },
      WhileStatement() { complexity++; },
      DoWhileStatement() { complexity++; },
      ForStatement() { complexity++; },
      ForInStatement() { complexity++; },
      ForOfStatement() { complexity++; },
      CatchClause() { complexity++; }
    });
    
    return complexity;
  }
}

// Supporting types
export interface ImportInfo {
  source: string;
  imports: ImportSpecifier[];
  isDefault: boolean;
  isNamespace: boolean;
}

export interface ImportSpecifier {
  imported: string;
  local: string;
}

export interface ExportInfo {
  name: string;
  type: 'named' | 'default' | 'namespace';
  source?: string;
}

export interface FunctionCall {
  name: string;
  arguments: number;
  line: number;
}
