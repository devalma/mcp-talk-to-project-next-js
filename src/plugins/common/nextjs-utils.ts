/**
 * Next.js Specific Analysis Utilities
 * 
 * Focused utilities for analyzing Next.js specific patterns and features
 */

import * as t from '@babel/types';
import traverse from '@babel/traverse';
import { ASTUtils } from './ast-utils.js';

// Handle ES module import issues
const traverseFunction = typeof traverse === 'function' ? traverse : (traverse as any).default;

export interface NextJSPageInfo {
  hasGetServerSideProps: boolean;
  hasGetStaticProps: boolean;
  hasGetStaticPaths: boolean;
  isApiRoute: boolean;
  isPageComponent: boolean;
  isDynamicRoute: boolean;
  routeParams: string[];
}

export interface NextJSApiInfo {
  httpMethods: string[];
  hasValidation: boolean;
  hasErrorHandling: boolean;
  usesNextAuth: boolean;
  usesMiddleware: boolean;
}

/**
 * Next.js specific analysis utilities
 */
export class NextJSUtils {
  /**
   * Analyze Next.js page patterns
   */
  static analyzePagePatterns(ast: t.File): NextJSPageInfo {
    const exports = ASTUtils.findExports(ast);
    
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
      this.isReactComponent(ast, exp.name)
    );

    return {
      hasGetServerSideProps,
      hasGetStaticProps,
      hasGetStaticPaths,
      isApiRoute,
      isPageComponent,
      isDynamicRoute: false, // Will be determined by file path
      routeParams: [] // Will be extracted from file path
    };
  }

  /**
   * Analyze API route patterns
   */
  static analyzeApiRoute(ast: t.File): NextJSApiInfo {
    const httpMethods = this.extractHttpMethods(ast);
    const hasValidation = this.hasValidationLogic(ast);
    const hasErrorHandling = this.hasErrorHandling(ast);
    const usesNextAuth = this.usesNextAuth(ast);
    const usesMiddleware = this.usesMiddleware(ast);

    return {
      httpMethods,
      hasValidation,
      hasErrorHandling,
      usesNextAuth,
      usesMiddleware
    };
  }

  /**
   * Extract HTTP methods handled by API route
   */
  private static extractHttpMethods(ast: t.File): string[] {
    const methods: string[] = [];

    traverseFunction(ast, {
      MemberExpression(path: any) {
        if (t.isIdentifier(path.node.object) &&
            (path.node.object.name === 'req' || path.node.object.name === 'request') &&
            t.isIdentifier(path.node.property) &&
            path.node.property.name === 'method') {
          
          // Look for switch/if statements checking method
          let parent = path.parent;
          while (parent) {
            if (t.isSwitchStatement(parent)) {
              this.extractMethodsFromSwitch(parent, methods);
              break;
            } else if (t.isIfStatement(parent)) {
              this.extractMethodsFromIf(parent, methods);
              break;
            }
            parent = parent.parent;
          }
        }
      }
    });

    return [...new Set(methods)];
  }

  private static extractMethodsFromSwitch(switchStmt: t.SwitchStatement, methods: string[]): void {
    for (const caseStmt of switchStmt.cases) {
      if (caseStmt.test && t.isStringLiteral(caseStmt.test)) {
        methods.push(caseStmt.test.value);
      }
    }
  }

  private static extractMethodsFromIf(ifStmt: t.IfStatement, methods: string[]): void {
    // Simple extraction for req.method === 'GET' patterns
    if (t.isBinaryExpression(ifStmt.test) && 
        (ifStmt.test.operator === '===' || ifStmt.test.operator === '==')) {
      if (t.isStringLiteral(ifStmt.test.right)) {
        methods.push(ifStmt.test.right.value);
      } else if (t.isStringLiteral(ifStmt.test.left)) {
        methods.push(ifStmt.test.left.value);
      }
    }
  }

  /**
   * Check if API route has validation logic
   */
  private static hasValidationLogic(ast: t.File): boolean {
    let hasValidation = false;

    traverseFunction(ast, {
      CallExpression(path: any) {
        // Look for common validation patterns
        if (t.isIdentifier(path.node.callee)) {
          const funcName = path.node.callee.name;
          if (['validate', 'validateInput', 'validateRequest', 'validateBody'].includes(funcName)) {
            hasValidation = true;
          }
        } else if (t.isMemberExpression(path.node.callee) && t.isIdentifier(path.node.callee.property)) {
          const methodName = path.node.callee.property.name;
          if (['validate', 'isValid', 'check'].includes(methodName)) {
            hasValidation = true;
          }
        }
      },
      IfStatement(path: any) {
        // Look for validation if statements
        if (this.isValidationCondition(path.node.test)) {
          hasValidation = true;
        }
      }
    });

    return hasValidation;
  }

  private static isValidationCondition(test: t.Expression): boolean {
    if (t.isBinaryExpression(test)) {
      // Check for typeof checks, length checks, etc.
      if (t.isUnaryExpression(test.left) && test.left.operator === 'typeof') {
        return true;
      }
      if (t.isMemberExpression(test.left) && 
          t.isIdentifier(test.left.property) && 
          test.left.property.name === 'length') {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if API route has error handling
   */
  private static hasErrorHandling(ast: t.File): boolean {
    let hasErrorHandling = false;

    traverseFunction(ast, {
      TryStatement() {
        hasErrorHandling = true;
      },
      CallExpression(path: any) {
        // Look for res.status(error) patterns
        if (t.isMemberExpression(path.node.callee) &&
            t.isIdentifier(path.node.callee.object) &&
            (path.node.callee.object.name === 'res' || path.node.callee.object.name === 'response') &&
            t.isIdentifier(path.node.callee.property) &&
            path.node.callee.property.name === 'status') {
          
          // Check if status is error status (400+)
          if (path.node.arguments.length > 0 && t.isNumericLiteral(path.node.arguments[0])) {
            const statusCode = path.node.arguments[0].value;
            if (statusCode >= 400) {
              hasErrorHandling = true;
            }
          }
        }
      }
    });

    return hasErrorHandling;
  }

  /**
   * Check if uses NextAuth
   */
  private static usesNextAuth(ast: t.File): boolean {
    const imports = ASTUtils.findImports(ast);
    return imports.some(imp => 
      imp.source.includes('next-auth') || 
      imp.source.includes('@auth')
    );
  }

  /**
   * Check if uses middleware
   */
  private static usesMiddleware(ast: t.File): boolean {
    let usesMiddleware = false;

    traverseFunction(ast, {
      CallExpression(path: any) {
        // Look for middleware patterns
        if (t.isIdentifier(path.node.callee)) {
          const funcName = path.node.callee.name;
          if (['middleware', 'runMiddleware', 'cors', 'authenticate'].includes(funcName)) {
            usesMiddleware = true;
          }
        }
      }
    });

    return usesMiddleware;
  }

  /**
   * Check if function has request/response parameters
   */
  private static hasRequestResponseParams(ast: t.File, functionName: string): boolean {
    let hasReqRes = false;

    traverseFunction(ast, {
      FunctionDeclaration(path: any) {
        if (path.node.id?.name === functionName) {
          hasReqRes = this.checkReqResParams(path.node.params);
        }
      },
      VariableDeclarator(path: any) {
        if (t.isIdentifier(path.node.id) && path.node.id.name === functionName) {
          if (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init)) {
            hasReqRes = this.checkReqResParams(path.node.init.params);
          }
        }
      }
    });

    return hasReqRes;
  }

  private static checkReqResParams(params: t.Function['params']): boolean {
    if (params.length >= 2) {
      const hasReqParam = params.some((param: any) => 
        t.isIdentifier(param) && (param.name === 'req' || param.name === 'request')
      );
      const hasResParam = params.some((param: any) => 
        t.isIdentifier(param) && (param.name === 'res' || param.name === 'response')
      );
      return hasReqParam && hasResParam;
    }
    return false;
  }

  /**
   * Check if function is a React component
   */
  private static isReactComponent(ast: t.File, functionName: string): boolean {
    let isComponent = false;

    traverseFunction(ast, {
      FunctionDeclaration(path: any) {
        if (path.node.id?.name === functionName) {
          isComponent = ASTUtils.containsJSX(path);
        }
      },
      VariableDeclarator(path: any) {
        if (t.isIdentifier(path.node.id) && path.node.id.name === functionName) {
          if (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init)) {
            const functionPath = {
              traverse: (visitor: any) => {
                traverseFunction(path.node.init, visitor);
              }
            };
            isComponent = ASTUtils.containsJSX(functionPath);
          }
        }
      }
    });

    return isComponent;
  }

  /**
   * Extract dynamic route parameters from file path
   */
  static extractRouteParams(filePath: string): string[] {
    const params: string[] = [];
    const matches = filePath.match(/\[([^\]]+)\]/g);
    
    if (matches) {
      for (const match of matches) {
        const param = match.slice(1, -1); // Remove brackets
        if (param.startsWith('...')) {
          params.push(param); // Catch-all route
        } else {
          params.push(param); // Dynamic route
        }
      }
    }
    
    return params;
  }

  /**
   * Generate route pattern from file path
   */
  static generateRoutePattern(filePath: string): string {
    let route = filePath
      .replace(/\.[^/.]+$/, '') // Remove file extension
      .replace(/\\/g, '/'); // Normalize path separators
    
    // Handle index files
    if (route.endsWith('/index') || route === 'index') {
      route = route.replace(/\/index$/, '') || '/';
    }
    
    // Handle dynamic routes
    route = route.replace(/\[([^\]]+)\]/g, (match, param) => {
      if (param.startsWith('...')) {
        return `*${param.slice(3)}`; // Catch-all
      }
      return `:${param}`; // Dynamic parameter
    });
    
    // Ensure route starts with /
    if (!route.startsWith('/')) {
      route = '/' + route;
    }
    
    return route;
  }

  /**
   * Check if file path represents a dynamic route
   */
  static isDynamicRoute(filePath: string): boolean {
    return /\[.*\]/.test(filePath);
  }

  /**
   * Check if file path represents an API route
   */
  static isApiRoute(filePath: string): boolean {
    return filePath.includes('/api/') || filePath.startsWith('api/');
  }
}
