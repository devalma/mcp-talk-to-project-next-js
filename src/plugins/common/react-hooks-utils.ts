/**
 * React Hooks Analysis Utilities
 * 
 * Focused utilities for analyzing React hooks usage and custom hooks
 */

import * as t from '@babel/types';
import traverse from '@babel/traverse';
import { ASTUtils } from './ast-utils.js';

// Handle ES module import issues
const traverseFunction = typeof traverse === 'function' ? traverse : (traverse as any).default;

export interface HookInfo {
  name: string;
  type: 'builtin' | 'custom';
  isExported: boolean;
  params: string[];
  usageCount?: number;
  locations?: Array<{ line?: number; column?: number }>;
}

export interface HookUsageInfo {
  hookName: string;
  usageCount: number;
  locations: Array<{ line?: number; column?: number; context?: string }>;
}

/**
 * React Hooks specific analysis utilities
 */
export class ReactHooksUtils {
  private static readonly BUILTIN_HOOKS = [
    'useState', 'useEffect', 'useContext', 'useReducer', 'useCallback',
    'useMemo', 'useRef', 'useImperativeHandle', 'useLayoutEffect',
    'useDebugValue', 'useDeferredValue', 'useTransition', 'useId',
    'useSyncExternalStore', 'useInsertionEffect'
  ];

  /**
   * Find all custom hooks defined in a file
   */
  static findCustomHooks(ast: t.File): HookInfo[] {
    if (!ast || typeof ast !== 'object') {
      console.warn('ReactHooksUtils.findCustomHooks: Invalid AST provided');
      return [];
    }

    const hooks: HookInfo[] = [];
    
    try {
      const exports = ASTUtils.findExports(ast);
      
      // Find exported hooks
      for (const exp of exports) {
        if (exp.name.startsWith('use') && exp.name.length > 3) {
          const params = this.extractFunctionParams(ast, exp.name);
          hooks.push({
            name: exp.name,
            type: 'custom',
            isExported: true,
            params
          });
        }
      }

      // Find non-exported hooks
      traverseFunction(ast, {
        FunctionDeclaration(path: any) {
          const functionName = path.node.id?.name;
          if (functionName && 
              functionName.startsWith('use') && 
              functionName.length > 3 &&
              !hooks.some(h => h.name === functionName)) {
            const params = ReactHooksUtils.extractFunctionParamsFromNode(path.node);
            hooks.push({
              name: functionName,
              type: 'custom',
              isExported: false,
              params
            });
          }
        },
        VariableDeclarator(path: any) {
          if (t.isIdentifier(path.node.id) && 
              path.node.id.name.startsWith('use') &&
              path.node.id.name.length > 3 &&
              (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init))) {
            const params = ReactHooksUtils.extractFunctionParamsFromNode(path.node.init);
            hooks.push({
              name: path.node.id.name,
              type: 'custom',
              isExported: false,
              params
            });
          }
        }
      });
    } catch (error) {
      console.warn('Error analyzing AST for custom hooks:', error instanceof Error ? error.message : String(error));
    }

    return hooks;
  }

  /**
   * Find all hook usage in a file
   */
  static findHookUsage(ast: t.File, targetHooks?: string[]): HookUsageInfo[] {
    const hooksToFind = targetHooks || ReactHooksUtils.BUILTIN_HOOKS;
    const hookUsage = new Map<string, Array<{ line?: number; column?: number; context?: string }>>();

    if (!ast) {
      return [];
    }

    try {
      traverseFunction(ast, {
        CallExpression(path: any) {
          if (t.isIdentifier(path.node.callee)) {
            const hookName = path.node.callee.name;
            if (hooksToFind.includes(hookName) || hookName.startsWith('use')) {
              if (!hookUsage.has(hookName)) {
                hookUsage.set(hookName, []);
              }
              
              // Get context (component or function name)
              const context = ReactHooksUtils.findContainingFunction(path);
              
              hookUsage.get(hookName)!.push({
                line: path.node.loc?.start.line,
                column: path.node.loc?.start.column,
                context
              });
            }
          }
        }
      });
    } catch (error) {
      console.warn('Error analyzing AST for hook usage:', error instanceof Error ? error.message : String(error));
    }

    return Array.from(hookUsage.entries()).map(([hookName, locations]) => ({
      hookName,
      usageCount: locations.length,
      locations
    }));
  }

  /**
   * Find builtin hook usage only
   */
  static findBuiltinHookUsage(ast: t.File): HookUsageInfo[] {
    return ReactHooksUtils.findHookUsage(ast, ReactHooksUtils.BUILTIN_HOOKS);
  }

  /**
   * Find custom hook usage only
   */
  static findCustomHookUsage(ast: t.File): HookUsageInfo[] {
    const allHookUsage = this.findHookUsage(ast);
    return allHookUsage.filter(usage => 
      !ReactHooksUtils.BUILTIN_HOOKS.includes(usage.hookName) && 
      usage.hookName.startsWith('use')
    );
  }

  /**
   * Analyze hook dependencies (for useEffect, useCallback, useMemo)
   */
  static analyzeHookDependencies(ast: t.File): Array<{
    hookName: string;
    hasDependencies: boolean;
    dependencyCount: number;
    missingDependencies: boolean;
    line?: number;
  }> {
    const dependencyHooks = ['useEffect', 'useCallback', 'useMemo', 'useLayoutEffect'];
    const results: Array<{
      hookName: string;
      hasDependencies: boolean;
      dependencyCount: number;
      missingDependencies: boolean;
      line?: number;
    }> = [];

    if (!ast) {
      return results;
    }

    try {
      traverseFunction(ast, {
        CallExpression(path: any) {
          if (t.isIdentifier(path.node.callee) && dependencyHooks.includes(path.node.callee.name)) {
            const hookName = path.node.callee.name;
            const args = path.node.arguments;
            
            let hasDependencies = false;
            let dependencyCount = 0;
            
            // Check for dependency array (second argument)
            if (args.length > 1 && t.isArrayExpression(args[1])) {
              hasDependencies = true;
              dependencyCount = args[1].elements.length;
            }

            results.push({
              hookName,
              hasDependencies,
              dependencyCount,
              missingDependencies: !hasDependencies && hookName === 'useEffect', // Simple heuristic
              line: path.node.loc?.start.line
            });
          }
        }
      });
    } catch (error) {
      console.warn('Error analyzing AST for hook dependencies:', error instanceof Error ? error.message : String(error));
    }

    return results;
  }

  /**
   * Extract function parameters from a function by name
   */
  private static extractFunctionParams(ast: t.File, functionName: string): string[] {
    let params: string[] = [];

    if (!ast) {
      return params;
    }

    try {
      traverseFunction(ast, {
        FunctionDeclaration(path: any) {
          if (path.node.id?.name === functionName) {
            params = ReactHooksUtils.extractFunctionParamsFromNode(path.node);
          }
        },
        VariableDeclarator(path: any) {
          if (t.isIdentifier(path.node.id) && 
              path.node.id.name === functionName &&
              (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init))) {
            params = ReactHooksUtils.extractFunctionParamsFromNode(path.node.init);
          }
        }
      });
    } catch (error) {
      console.warn('Error extracting function params:', error instanceof Error ? error.message : String(error));
    }

    return params;
  }

  /**
   * Extract function parameters from AST node
   */
  private static extractFunctionParamsFromNode(node: t.Function): string[] {
    return node.params.map(param => {
      if (t.isIdentifier(param)) {
        return param.name;
      } else if (t.isObjectPattern(param)) {
        return '{...}'; // Simplified for object destructuring
      } else if (t.isArrayPattern(param)) {
        return '[...]'; // Simplified for array destructuring
      } else if (t.isRestElement(param) && t.isIdentifier(param.argument)) {
        return `...${param.argument.name}`;
      } else {
        return 'unknown';
      }
    });
  }

  /**
   * Find the containing function/component name for a hook call
   */
  private static findContainingFunction(path: any): string | undefined {
    let current = path.parent;
    
    while (current) {
      if (t.isFunctionDeclaration(current) && current.id) {
        return current.id.name;
      } else if (t.isVariableDeclarator(current) && t.isIdentifier(current.id)) {
        return current.id.name;
      }
      current = current.parent;
    }
    
    return undefined;
  }

  /**
   * Validate hook rules (hooks only called at top level)
   */
  static validateHookRules(ast: t.File): Array<{
    violation: string;
    hookName: string;
    line?: number;
    suggestion: string;
  }> {
    const violations: Array<{
      violation: string;
      hookName: string;
      line?: number;
      suggestion: string;
    }> = [];

    if (!ast) {
      return violations;
    }

    try {
      traverseFunction(ast, {
        CallExpression(path: any) {
          if (t.isIdentifier(path.node.callee) && 
              (ReactHooksUtils.BUILTIN_HOOKS.includes(path.node.callee.name) || path.node.callee.name.startsWith('use'))) {
            
            const hookName = path.node.callee.name;
            
            // Check if inside conditional/loop
            if (ReactHooksUtils.isInsideConditional(path)) {
              violations.push({
                violation: 'Hook called conditionally',
                hookName,
                line: path.node.loc?.start.line,
                suggestion: 'Move hook to top level of component'
              });
            }
            
            // Check if inside nested function
            if (ReactHooksUtils.isInsideNestedFunction(path)) {
              violations.push({
                violation: 'Hook called in nested function',
                hookName,
                line: path.node.loc?.start.line,
                suggestion: 'Move hook to component level or create custom hook'
              });
            }
          }
        }
      });
    } catch (error) {
      console.warn('Error validating hook rules:', error instanceof Error ? error.message : String(error));
    }

    return violations;
  }

  private static isInsideConditional(path: any): boolean {
    let current = path.parent;
    while (current) {
      if (t.isIfStatement(current) || 
          t.isConditionalExpression(current) ||
          t.isWhileStatement(current) ||
          t.isForStatement(current) ||
          t.isForInStatement(current) ||
          t.isForOfStatement(current)) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  private static isInsideNestedFunction(path: any): boolean {
    let functionCount = 0;
    let current = path.parent;
    
    while (current) {
      if (t.isFunctionDeclaration(current) || 
          t.isFunctionExpression(current) || 
          t.isArrowFunctionExpression(current)) {
        functionCount++;
        if (functionCount > 1) {
          return true;
        }
      }
      current = current.parent;
    }
    
    return false;
  }
}
