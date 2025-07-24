/**
 * React Component Analysis Utilities
 * 
 * Focused utilities for analyzing React components
 */

import * as t from '@babel/types';
import traverse from '@babel/traverse';
import { ASTUtils, type ExportInfo } from './ast-utils.js';

// Handle ES module import issues
const traverseFunction = typeof traverse === 'function' ? traverse : (traverse as any).default;

export interface ComponentInfo {
  name: string;
  type: 'functional' | 'class';
  isDefault: boolean;
  isExported: boolean;
  hasProps: boolean;
  hasState: boolean;
  hooks: string[];
}

/**
 * React Component specific analysis utilities
 */
export class ReactComponentUtils {
  /**
   * Check if a file contains React components
   */
  static isReactComponentFile(ast: t.File): boolean {
    if (!ast || typeof ast !== 'object') {
      return false;
    }

    try {
      const imports = ASTUtils.findImports(ast);
      
      // Check for React import
      const hasReactImport = imports.some(imp => 
        imp.source === 'react' || 
        imp.imports.some(i => i.local === 'React')
      );

      // Check for JSX usage
      const hasJSX = ReactComponentUtils.hasJSXElements(ast);

      // Check for component exports
      const hasComponentExport = ReactComponentUtils.findReactComponents(ast).length > 0;

      return hasReactImport || hasJSX || hasComponentExport;
    } catch (error: any) {
      console.warn('ReactComponentUtils.isReactComponentFile: Error during analysis:', error.message);
      return false;
    }
  }

  /**
   * Check if AST contains JSX elements
   */
  static hasJSXElements(ast: t.File): boolean {
    if (!ast || typeof ast !== 'object') {
      return false;
    }

    let hasJSX = false;

    try {
      traverseFunction(ast, {
        JSXElement() { hasJSX = true; },
        JSXFragment() { hasJSX = true; }
      });
    } catch (error: any) {
      console.warn('ReactComponentUtils.hasJSXElements: Error during traversal:', error.message);
    }

    return hasJSX;
  }

  /**
   * Find all React components in a file
   */
  static findReactComponents(ast: t.File): ComponentInfo[] {
    if (!ast || typeof ast !== 'object') {
      console.warn('ReactComponentUtils.findReactComponents: Invalid AST provided');
      return [];
    }

    const components: ComponentInfo[] = [];
    
    try {
      const exports = ASTUtils.findExports(ast);
      
      for (const exp of exports) {
        const isDefault = exp.type === 'default';
        
        if (ReactComponentUtils.isFunctionalComponent(ast, exp.name)) {
          const hooks = ReactComponentUtils.extractComponentHooks(ast, exp.name);
          components.push({
            name: exp.name,
            type: 'functional',
            isDefault,
            isExported: true,
            hasProps: ReactComponentUtils.hasProps(ast, exp.name),
            hasState: hooks.includes('useState'),
            hooks
          });
        } else if (ReactComponentUtils.isClassComponent(ast, exp.name)) {
          components.push({
            name: exp.name,
            type: 'class',
            isDefault,
            isExported: true,
            hasProps: ReactComponentUtils.hasProps(ast, exp.name),
            hasState: ReactComponentUtils.hasClassState(ast, exp.name),
            hooks: []
          });
        }
      }
    } catch (error: any) {
      console.warn('ReactComponentUtils.findReactComponents: Error during analysis:', error.message);
    }

    return components;
  }

  /**
   * Check if a function is a React functional component
   */
  static isFunctionalComponent(ast: t.File, name: string): boolean {
    let isComponent = false;

    traverseFunction(ast, {
      FunctionDeclaration(path: any) {
        if (path.node.id?.name === name) {
          isComponent = ASTUtils.containsJSX(path);
        }
      },
      VariableDeclarator(path: any) {
        if (t.isIdentifier(path.node.id) && path.node.id.name === name) {
          if (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init)) {
            // Check for JSX by traversing the function body
            try {
              traverseFunction(path.node.init, {
                JSXElement: () => {
                  isComponent = true;
                },
                JSXFragment: () => {
                  isComponent = true;
                }
              }, path.scope, path);
            } catch (error) {
              // Fallback: check for basic JSX patterns in the function
              if (path.node.init.body) {
                const bodyStr = JSON.stringify(path.node.init.body);
                isComponent = bodyStr.includes('JSXElement') || bodyStr.includes('JSXFragment');
              }
            }
          }
        }
      }
    });

    return isComponent;
  }

  /**
   * Check if a class is a React component
   */
  static isClassComponent(ast: t.File, name: string): boolean {
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
   * Extract hooks used in a component
   */
  static extractComponentHooks(ast: t.File, componentName: string): string[] {
    const hooks: string[] = [];
    const builtinHooks = [
      'useState', 'useEffect', 'useContext', 'useReducer', 'useCallback',
      'useMemo', 'useRef', 'useImperativeHandle', 'useLayoutEffect',
      'useDebugValue', 'useDeferredValue', 'useTransition', 'useId',
      'useSyncExternalStore', 'useInsertionEffect'
    ];

    try {
      traverseFunction(ast, {
        FunctionDeclaration(path: any) {
          if (path.node.id?.name === componentName) {
            ReactComponentUtils.findHooksInFunction(path, hooks, builtinHooks);
          }
        },
        VariableDeclarator(path: any) {
          if (t.isIdentifier(path.node.id) && path.node.id.name === componentName) {
            if (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init)) {
              ReactComponentUtils.findHooksInFunctionWithScope(path.node.init, hooks, builtinHooks, path.scope, path);
            }
          }
        }
      });
    } catch (error) {
      // Silently fail and return empty hooks array
    }

    return [...new Set(hooks)]; // Remove duplicates
  }

  private static findHooksInFunction(functionPath: any, hooks: string[], builtinHooks: string[]): void {
    try {
      functionPath.traverse({
        CallExpression(path: any) {
          if (t.isIdentifier(path.node.callee)) {
            const hookName = path.node.callee.name;
            if (builtinHooks.includes(hookName) || hookName.startsWith('use')) {
              hooks.push(hookName);
            }
          }
        }
      });
    } catch (error) {
      // Silently fail
    }
  }

  private static findHooksInFunctionWithScope(node: t.Function, hooks: string[], builtinHooks: string[], scope?: any, parentPath?: any): void {
    try {
      if (scope && parentPath) {
        traverseFunction(node, {
          CallExpression(path: any) {
            if (t.isIdentifier(path.node.callee)) {
              const hookName = path.node.callee.name;
              if (builtinHooks.includes(hookName) || hookName.startsWith('use')) {
                hooks.push(hookName);
              }
            }
          }
        }, scope, parentPath);
      } else {
        // Fallback: simple string search for hook patterns
        const nodeStr = JSON.stringify(node);
        builtinHooks.forEach(hook => {
          if (nodeStr.includes(hook)) {
            hooks.push(hook);
          }
        });
      }
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Check if component has props parameter
   */
  static hasProps(ast: t.File, componentName: string): boolean {
    let hasProps = false;

    traverseFunction(ast, {
      FunctionDeclaration(path: any) {
        if (path.node.id?.name === componentName && path.node.params.length > 0) {
          hasProps = true;
        }
      },
      VariableDeclarator(path: any) {
        if (t.isIdentifier(path.node.id) && path.node.id.name === componentName) {
          if ((t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init)) &&
              path.node.init.params.length > 0) {
            hasProps = true;
          }
        }
      }
    });

    return hasProps;
  }

  /**
   * Check if class component has state
   */
  static hasClassState(ast: t.File, componentName: string): boolean {
    let hasState = false;

    traverseFunction(ast, {
      ClassDeclaration(path: any) {
        if (path.node.id?.name === componentName) {
          path.traverse({
            MemberExpression(memberPath: any) {
              if (t.isThisExpression(memberPath.node.object) &&
                  t.isIdentifier(memberPath.node.property) &&
                  memberPath.node.property.name === 'state') {
                hasState = true;
              }
            }
          });
        }
      }
    });

    return hasState;
  }

  /**
   * Extract component props interface/type
   */
  static extractPropsType(ast: t.File, componentName: string): string | null {
    let propsType: string | null = null;

    traverseFunction(ast, {
      FunctionDeclaration(path: any) {
        if (path.node.id?.name === componentName && path.node.params.length > 0) {
          const firstParam = path.node.params[0];
          if (t.isIdentifier(firstParam) && firstParam.typeAnnotation) {
            // Extract TypeScript type annotation
            propsType = ReactComponentUtils.extractTypeAnnotation(firstParam.typeAnnotation);
          }
        }
      }
    });

    return propsType;
  }

  private static extractTypeAnnotation(typeAnnotation: any): string {
    // Simplified type extraction - could be expanded
    if (typeAnnotation.typeAnnotation) {
      if (t.isTSTypeReference(typeAnnotation.typeAnnotation)) {
        return typeAnnotation.typeAnnotation.typeName.name;
      }
    }
    return 'unknown';
  }
}
