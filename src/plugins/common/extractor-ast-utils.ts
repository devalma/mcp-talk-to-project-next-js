/**
 * Enhanced AST Processing Utilities
 * 
 * Provides common patterns for AST processing that extractors use repeatedly
 */

import * as t from '@babel/types';
import traverse from '@babel/traverse';
import { ASTUtils, type ImportInfo, type ExportInfo } from './ast-utils.js';

// Handle ES module import issues
const traverseFunction = typeof traverse === 'function' ? traverse : (traverse as any).default;

// Extended export info for React components
interface ComponentExportInfo extends ExportInfo {
  isDefault: boolean;
  exportType: 'function' | 'class' | 'variable';
}

/**
 * Common AST processing patterns used across extractors
 */
export class ExtractorASTUtils extends ASTUtils {
  
  /**
   * Check if a file is a React component file
   */
  static isReactComponentFile(ast: t.File): boolean {
    const imports = this.findImports(ast);
    
    // Check for React import
    const hasReactImport = imports.some(imp => 
      imp.source === 'react' || 
      imp.imports.some(i => i.local === 'React')
    );

    // Check for JSX usage
    const hasJSX = this.hasJSXElements(ast);

    // Check for component exports
    const exports = this.findExports(ast);
    const hasComponentExport = exports.some(exp => 
      this.isReactFunctionComponent(ast, exp.name)
    );

    return hasReactImport || hasJSX || hasComponentExport;
  }

  /**
   * Check if AST contains JSX elements
   */
  static hasJSXElements(ast: t.File): boolean {
    let hasJSX = false;

    traverseFunction(ast, {
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
   * Extract all React components from a file
   */
  static findReactComponents(ast: t.File): Array<{
    name: string;
    type: 'functional' | 'class';
    isDefault: boolean;
    isExported: boolean;
  }> {
    const components: Array<{
      name: string;
      type: 'functional' | 'class';
      isDefault: boolean;
      isExported: boolean;
    }> = [];
    
    const exports = this.findExports(ast);
    
    for (const exp of exports) {
      const isDefault = exp.type === 'default';
      
      if (this.isReactFunctionComponent(ast, exp.name)) {
        components.push({
          name: exp.name,
          type: 'functional',
          isDefault,
          isExported: true
        });
      } else if (this.isReactClassComponent(ast, exp.name)) {
        components.push({
          name: exp.name,
          type: 'class',
          isDefault,
          isExported: true
        });
      }
    }

    return components;
  }

  /**
   * Check if a function is a React functional component
   */
  static isReactFunctionComponent(ast: t.File, name: string): boolean {
    let isComponent = false;

    traverseFunction(ast, {
      FunctionDeclaration(path: any) {
        if (path.node.id?.name === name) {
          isComponent = this.containsJSX(path);
        }
      },
      VariableDeclarator(path: any) {
        if (t.isIdentifier(path.node.id) && path.node.id.name === name) {
          if (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init)) {
            isComponent = this.containsJSX(path.get('init'));
          }
        }
      }
    });

    return isComponent;
  }

  /**
   * Check if a function is a React class component
   */
  static isReactClassComponent(ast: t.File, name: string): boolean {
    let isReactComponent = false;

    traverseFunction(ast, {
      ClassDeclaration(path: any) {
        if (path.node.id?.name === name && path.node.superClass) {
          // Check if extends React.Component or Component
          if (t.isMemberExpression(path.node.superClass) &&
              t.isIdentifier(path.node.superClass.object) &&
              path.node.superClass.object.name === 'React' &&
              t.isIdentifier(path.node.superClass.property) &&
              (path.node.superClass.property.name === 'Component' || 
               path.node.superClass.property.name === 'PureComponent')) {
            isReactComponent = true;
          } else if (t.isIdentifier(path.node.superClass) &&
                     (path.node.superClass.name === 'Component' || 
                      path.node.superClass.name === 'PureComponent')) {
            isReactComponent = true;
          }
        }
      }
    });

    return isReactComponent;
  }

  /**
   * Find all custom hooks in a file (functions starting with 'use')
   */
  static findCustomHooks(ast: t.File): Array<{
    name: string;
    isExported: boolean;
    params: string[];
    returnType?: string;
  }> {
    const hooks: Array<{
      name: string;
      isExported: boolean;
      params: string[];
      returnType?: string;
    }> = [];

    const exports = this.findExports(ast);
    
    // Find exported hooks
    for (const exp of exports) {
      if (exp.name.startsWith('use')) {
        const params = this.extractFunctionParams(ast, exp.name);
        hooks.push({
          name: exp.name,
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
            !hooks.some(h => h.name === functionName)) {
          const params = this.extractFunctionParamsFromNode(path.node);
          hooks.push({
            name: functionName,
            isExported: false,
            params
          });
        }
      },
      VariableDeclarator(path: any) {
        if (t.isIdentifier(path.node.id) && 
            path.node.id.name.startsWith('use') &&
            (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init))) {
          const params = this.extractFunctionParamsFromNode(path.node.init);
          hooks.push({
            name: path.node.id.name,
            isExported: false,
            params
          });
        }
      }
    });

    return hooks;
  }

  /**
   * Extract function parameters from a function by name
   */
  static extractFunctionParams(ast: t.File, functionName: string): string[] {
    let params: string[] = [];

    traverseFunction(ast, {
      FunctionDeclaration(path: any) {
        if (path.node.id?.name === functionName) {
          params = this.extractFunctionParamsFromNode(path.node);
        }
      },
      VariableDeclarator(path: any) {
        if (t.isIdentifier(path.node.id) && 
            path.node.id.name === functionName &&
            (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init))) {
          params = this.extractFunctionParamsFromNode(path.node.init);
        }
      }
    });

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
      } else {
        return 'unknown';
      }
    });
  }

  /**
   * Extract built-in React hook usage from a file
   */
  static findHookUsage(ast: t.File, targetHooks?: string[]): Array<{
    hookName: string;
    usageCount: number;
    locations: Array<{ line?: number; column?: number }>;
  }> {
    const builtinHooks = targetHooks || [
      'useState', 'useEffect', 'useContext', 'useReducer', 'useCallback',
      'useMemo', 'useRef', 'useImperativeHandle', 'useLayoutEffect',
      'useDebugValue', 'useDeferredValue', 'useTransition', 'useId',
      'useSyncExternalStore', 'useInsertionEffect'
    ];

    const hookUsage = new Map<string, Array<{ line?: number; column?: number }>>();

    traverseFunction(ast, {
      CallExpression(path: any) {
        if (t.isIdentifier(path.node.callee)) {
          const hookName = path.node.callee.name;
          if (builtinHooks.includes(hookName)) {
            if (!hookUsage.has(hookName)) {
              hookUsage.set(hookName, []);
            }
            hookUsage.get(hookName)!.push({
              line: path.node.loc?.start.line,
              column: path.node.loc?.start.column
            });
          }
        }
      }
    });

    return Array.from(hookUsage.entries()).map(([hookName, locations]) => ({
      hookName,
      usageCount: locations.length,
      locations
    }));
  }

  /**
   * Find Next.js specific patterns
   */
  static findNextJSPatterns(ast: t.File): {
    hasGetServerSideProps: boolean;
    hasGetStaticProps: boolean;
    hasGetStaticPaths: boolean;
    isApiRoute: boolean;
    isPageComponent: boolean;
  } {
    const exports = this.findExports(ast);
    
    const hasGetServerSideProps = exports.some(exp => exp.name === 'getServerSideProps');
    const hasGetStaticProps = exports.some(exp => exp.name === 'getStaticProps');
    const hasGetStaticPaths = exports.some(exp => exp.name === 'getStaticPaths');
    
    // Check for API route patterns
    const isApiRoute = exports.some(exp => 
      exp.type === 'default' &&
      this.hasRequestResponseParams(ast, exp.name)
    );

    // Check for page component patterns
    const isPageComponent = exports.some(exp => 
      exp.type === 'default' &&
      this.isReactFunctionComponent(ast, exp.name)
    );

    return {
      hasGetServerSideProps,
      hasGetStaticProps,
      hasGetStaticPaths,
      isApiRoute,
      isPageComponent
    };
  }

  /**
   * Check if a function has request/response parameters (API route pattern)
   */
  private static hasRequestResponseParams(ast: t.File, functionName: string): boolean {
    let hasReqRes = false;

    traverseFunction(ast, {
      FunctionDeclaration(path: any) {
        if (path.node.id?.name === functionName) {
          const params = path.node.params;
          if (params.length >= 2) {
            // Check if parameters look like req, res
            const hasReqParam = params.some((param: any) => 
              t.isIdentifier(param) && (param.name === 'req' || param.name === 'request')
            );
            const hasResParam = params.some((param: any) => 
              t.isIdentifier(param) && (param.name === 'res' || param.name === 'response')
            );
            hasReqRes = hasReqParam && hasResParam;
          }
        }
      }
    });

    return hasReqRes;
  }

  /**
   * Extract context usage patterns
   */
  static findContextUsage(ast: t.File): Array<{
    contextName: string;
    providerName?: string;
    hookName?: string;
    consumesContext: boolean;
    providesContext: boolean;
  }> {
    const contexts: Array<{
      contextName: string;
      providerName?: string;
      hookName?: string;
      consumesContext: boolean;
      providesContext: boolean;
    }> = [];

    traverseFunction(ast, {
      CallExpression(path: any) {
        // Look for React.createContext() or createContext()
        if ((t.isMemberExpression(path.node.callee) &&
             t.isIdentifier(path.node.callee.object) &&
             path.node.callee.object.name === 'React' &&
             t.isIdentifier(path.node.callee.property) &&
             path.node.callee.property.name === 'createContext') ||
            (t.isIdentifier(path.node.callee) &&
             path.node.callee.name === 'createContext')) {
          
          // Find the variable that stores this context
          const parent = path.findParent((p: any) => t.isVariableDeclarator(p.node));
          if (parent && t.isIdentifier(parent.node.id)) {
            const contextName = parent.node.id.name;
            
            contexts.push({
              contextName,
              consumesContext: false,
              providesContext: true
            });
          }
        }
      }
    });

    return contexts;
  }
}
