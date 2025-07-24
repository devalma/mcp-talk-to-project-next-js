/**
 * React Context Analysis Utilities
 * 
 * Focused utilities for analyzing React Context usage patterns
 */

import * as t from '@babel/types';
import traverse from '@babel/traverse';
import { ASTUtils } from './ast-utils.js';

// Handle ES module import issues
const traverseFunction = typeof traverse === 'function' ? traverse : (traverse as any).default;

export interface ContextInfo {
  contextName: string;
  providerName?: string;
  hookName?: string;
  consumesContext: boolean;
  providesContext: boolean;
  defaultValue?: string;
  location?: { line?: number; column?: number };
}

export interface ContextUsageInfo {
  contextName: string;
  usageType: 'provider' | 'consumer' | 'hook';
  componentName?: string;
  location?: { line?: number; column?: number };
}

/**
 * React Context specific analysis utilities
 */
export class ReactContextUtils {
  /**
   * Find all context definitions in a file
   */
  static findContextDefinitions(ast: t.File): ContextInfo[] {
    const contexts: ContextInfo[] = [];

    traverseFunction(ast, {
      CallExpression(path: any) {
        // Look for React.createContext() or createContext()
        if (ReactContextUtils.isCreateContextCall(path.node)) {
          const contextName = ReactContextUtils.extractContextName(path);
          if (contextName) {
            const defaultValue = ReactContextUtils.extractDefaultValue(path.node);
            
            contexts.push({
              contextName,
              consumesContext: false,
              providesContext: true,
              defaultValue,
              location: {
                line: path.node.loc?.start.line,
                column: path.node.loc?.start.column
              }
            });
          }
        }
      }
    });

    return contexts;
  }

  /**
   * Find all context usage in a file
   */
  static findContextUsage(ast: t.File): ContextUsageInfo[] {
    const usage: ContextUsageInfo[] = [];

    traverseFunction(ast, {
      JSXElement(path: any) {
        // Look for Provider usage
        const elementName = ReactContextUtils.getJSXElementName(path.node);
        if (elementName && elementName.endsWith('.Provider')) {
          const contextName = elementName.replace('.Provider', '');
          usage.push({
            contextName,
            usageType: 'provider',
            location: {
              line: path.node.loc?.start.line,
              column: path.node.loc?.start.column
            }
          });
        }
      },
      CallExpression(path: any) {
        // Look for useContext usage
        if (t.isIdentifier(path.node.callee) && path.node.callee.name === 'useContext') {
          const contextName = ReactContextUtils.extractContextFromUseContext(path.node);
          if (contextName) {
            usage.push({
              contextName,
              usageType: 'consumer',
              componentName: ReactContextUtils.findContainingComponent(path),
              location: {
                line: path.node.loc?.start.line,
                column: path.node.loc?.start.column
              }
            });
          }
        }
      }
    });

    return usage;
  }

  /**
   * Find provider-consumer relationships
   */
  static analyzeContextFlow(ast: t.File): Array<{
    contextName: string;
    hasProvider: boolean;
    hasConsumer: boolean;
    providerCount: number;
    consumerCount: number;
  }> {
    const contexts = ReactContextUtils.findContextDefinitions(ast);
    const usage = ReactContextUtils.findContextUsage(ast);
    
    return contexts.map(context => {
      const providers = usage.filter(u => 
        u.contextName === context.contextName && u.usageType === 'provider'
      );
      const consumers = usage.filter(u => 
        u.contextName === context.contextName && 
        (u.usageType === 'consumer' || u.usageType === 'hook')
      );

      return {
        contextName: context.contextName,
        hasProvider: providers.length > 0,
        hasConsumer: consumers.length > 0,
        providerCount: providers.length,
        consumerCount: consumers.length
      };
    });
  }

  /**
   * Check if a call expression is createContext
   */
  private static isCreateContextCall(node: t.CallExpression): boolean {
    return (
      // React.createContext()
      (t.isMemberExpression(node.callee) &&
       t.isIdentifier(node.callee.object) &&
       node.callee.object.name === 'React' &&
       t.isIdentifier(node.callee.property) &&
       node.callee.property.name === 'createContext') ||
      // createContext()
      (t.isIdentifier(node.callee) && node.callee.name === 'createContext')
    );
  }

  /**
   * Extract context name from createContext assignment
   */
  private static extractContextName(path: any): string | null {
    // Find the variable that stores this context
    const parent = path.findParent((p: any) => t.isVariableDeclarator(p.node));
    if (parent && t.isIdentifier(parent.node.id)) {
      return parent.node.id.name;
    }
    return null;
  }

  /**
   * Extract default value from createContext call
   */
  private static extractDefaultValue(node: t.CallExpression): string | undefined {
    if (node.arguments.length > 0) {
      const arg = node.arguments[0];
      if (t.isStringLiteral(arg)) {
        return arg.value;
      } else if (t.isNumericLiteral(arg)) {
        return arg.value.toString();
      } else if (t.isBooleanLiteral(arg)) {
        return arg.value.toString();
      } else if (t.isNullLiteral(arg)) {
        return 'null';
      } else if (t.isObjectExpression(arg)) {
        return '{}';
      } else if (t.isArrayExpression(arg)) {
        return '[]';
      }
    }
    return undefined;
  }

  /**
   * Get JSX element name
   */
  private static getJSXElementName(node: t.JSXElement): string | null {
    if (t.isJSXIdentifier(node.openingElement.name)) {
      return node.openingElement.name.name;
    } else if (t.isJSXMemberExpression(node.openingElement.name)) {
      const object = node.openingElement.name.object;
      const property = node.openingElement.name.property;
      if (t.isJSXIdentifier(object) && t.isJSXIdentifier(property)) {
        return `${object.name}.${property.name}`;
      }
    }
    return null;
  }

  /**
   * Extract context name from useContext call
   */
  private static extractContextFromUseContext(node: t.CallExpression): string | null {
    if (node.arguments.length > 0) {
      const arg = node.arguments[0];
      if (t.isIdentifier(arg)) {
        return arg.name;
      }
    }
    return null;
  }

  /**
   * Find the containing component for a context usage
   */
  private static findContainingComponent(path: any): string | undefined {
    let current = path.parent;
    
    while (current) {
      if (t.isFunctionDeclaration(current) && current.id) {
        return current.id.name;
      } else if (t.isVariableDeclarator(current) && t.isIdentifier(current.id)) {
        // Check if it's a component (starts with capital letter)
        if (current.id.name[0] === current.id.name[0].toUpperCase()) {
          return current.id.name;
        }
      }
      current = current.parent;
    }
    
    return undefined;
  }

  /**
   * Find context providers and their props
   */
  static findContextProviders(ast: t.File): Array<{
    contextName: string;
    hasValue: boolean;
    valueType?: string;
    location?: { line?: number; column?: number };
  }> {
    const providers: Array<{
      contextName: string;
      hasValue: boolean;
      valueType?: string;
      location?: { line?: number; column?: number };
    }> = [];

    traverseFunction(ast, {
      JSXElement(path: any) {
        const elementName = ReactContextUtils.getJSXElementName(path.node);
        if (elementName && elementName.endsWith('.Provider')) {
          const contextName = elementName.replace('.Provider', '');
          
          // Check for value prop
          let hasValue = false;
          let valueType: string | undefined;
          
          for (const attr of path.node.openingElement.attributes) {
            if (t.isJSXAttribute(attr) && 
                t.isJSXIdentifier(attr.name) && 
                attr.name.name === 'value') {
              hasValue = true;
              valueType = ReactContextUtils.getValueType(attr.value);
              break;
            }
          }

          providers.push({
            contextName,
            hasValue,
            valueType,
            location: {
              line: path.node.loc?.start.line,
              column: path.node.loc?.start.column
            }
          });
        }
      }
    });

    return providers;
  }

  /**
   * Get the type of a JSX attribute value
   */
  private static getValueType(value: t.JSXAttribute['value']): string {
    if (!value) return 'undefined';
    
    if (t.isStringLiteral(value)) {
      return 'string';
    } else if (t.isJSXExpressionContainer(value)) {
      const expr = value.expression;
      if (t.isObjectExpression(expr)) {
        return 'object';
      } else if (t.isArrayExpression(expr)) {
        return 'array';
      } else if (t.isIdentifier(expr)) {
        return 'variable';
      } else if (t.isCallExpression(expr)) {
        return 'function_call';
      }
    }
    
    return 'unknown';
  }

  /**
   * Analyze context performance patterns
   */
  static analyzeContextPerformance(ast: t.File): Array<{
    contextName: string;
    hasOptimization: boolean;
    optimizationType?: 'useMemo' | 'useCallback' | 'split_context';
    suggestion?: string;
  }> {
    const contexts = ReactContextUtils.findContextDefinitions(ast);
    const results: Array<{
      contextName: string;
      hasOptimization: boolean;
      optimizationType?: 'useMemo' | 'useCallback' | 'split_context';
      suggestion?: string;
    }> = [];

    for (const context of contexts) {
      const hasOptimization = ReactContextUtils.hasContextOptimization(ast, context.contextName);
      
      results.push({
        contextName: context.contextName,
        hasOptimization,
        optimizationType: hasOptimization ? ReactContextUtils.getOptimizationType(ast, context.contextName) : undefined,
        suggestion: hasOptimization ? undefined : 'Consider using useMemo for context value to prevent unnecessary re-renders'
      });
    }

    return results;
  }

  private static hasContextOptimization(ast: t.File, contextName: string): boolean {
    let hasOptimization = false;

    traverseFunction(ast, {
      CallExpression(path: any) {
        if (t.isIdentifier(path.node.callee)) {
          const funcName = path.node.callee.name;
          if (['useMemo', 'useCallback'].includes(funcName)) {
            // Check if this optimization is related to our context
            // This is a simplified check
            hasOptimization = true;
          }
        }
      }
    });

    return hasOptimization;
  }

  private static getOptimizationType(ast: t.File, contextName: string): 'useMemo' | 'useCallback' | 'split_context' {
    // Simplified implementation
    return 'useMemo';
  }
}
