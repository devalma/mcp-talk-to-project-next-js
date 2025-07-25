/**
 * AST Analyzer Module - Analyzes JavaScript/TypeScript AST for i18n patterns using modular validators
 */

import { ASTUtils } from '../common/ast-utils.js';
import { PluginLogger } from '../common/logger.js';
import { DEFAULT_I18N_CONFIG, DEFAULT_EXCLUDE_PATTERNS } from './config.js';
import { ValidatorRegistry, ValidationInput } from './validators/index.js';
import type { 
  I18nExtractorConfig, 
  UntranslatedString, 
  TranslationUsage, 
  I18nIssue 
} from './types.js';

export class ASTAnalyzer {
  private config: I18nExtractorConfig;
  private logger: PluginLogger;
  private currentFile: string = '';
  private validatorRegistry: ValidatorRegistry;

  constructor(config: I18nExtractorConfig) {
    this.config = {
      ...DEFAULT_I18N_CONFIG,
      ...config
    };
    
    this.logger = new PluginLogger('ast-analyzer');
    this.validatorRegistry = new ValidatorRegistry();
  }

  /**
   * Find untranslated strings in the AST
   */
  async findUntranslatedStrings(ast: any, content: string): Promise<UntranslatedString[]> {
    const untranslatedStrings: UntranslatedString[] = [];

    try {
      // Clean implementation: Whitelist approach with modular validators
      ASTUtils.traverse(ast, {
        // VALIDATOR 1: JSX Text Content
        JSXText: (path: any) => {
          if (!this.config.analyzeJSXText) return;

          const text = path.node.value.trim();
          
          const validationResult = this.validatorRegistry.validate({
            text,
            type: 'jsx-text',
            context: {}
          });

          if (validationResult.isValid) {
            untranslatedStrings.push({
              text,
              type: 'jsx-text',
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0,
              context: this.getNodeContext(path),
              isLikelyTranslatable: true,
              suggestedKey: this.generateTranslationKey(text)
            });
          }
        },

        // VALIDATOR 2: User-facing JSX Attributes + VALIDATOR 6: Component Props
        JSXAttribute: (path: any) => {
          if (!this.config.analyzeJSXAttributes) return;

          const attributeName = path.node.name?.name;
          const attributeValue = path.node.value;
          
          // Only process string literal values (handle both Literal and StringLiteral types)
          if ((attributeValue?.type === 'Literal' || attributeValue?.type === 'StringLiteral') && typeof attributeValue.value === 'string') {
            const text = attributeValue.value.trim();
            
            // Determine if this is a component prop or HTML attribute
            const isComponentProp = this.isComponentProp(path);
            const validationType = isComponentProp ? 'component-prop' : 'jsx-attribute';
            
            const validationResult = this.validatorRegistry.validate({
              text,
              type: validationType,
              context: { attributeName }
            });

            if (validationResult.isValid) {
              untranslatedStrings.push({
                text,
                type: validationType,
                line: path.node.loc?.start.line || 0,
                column: path.node.loc?.start.column || 0,
                context: isComponentProp ? `Component ${attributeName} prop` : `JSX ${attributeName} attribute`,
                isLikelyTranslatable: true,
                suggestedKey: this.generateTranslationKey(text)
              });
            }
          }
        },

        // VALIDATOR 3: User Message Variables
        VariableDeclarator: (path: any) => {
          if (!this.config.analyzeStringLiterals) return;

          const variableName = path.node.id?.name;
          const init = path.node.init;
          
          // Only process string literal initializers
          if (variableName && (init?.type === 'Literal' || init?.type === 'StringLiteral') && typeof init.value === 'string') {
            const text = init.value.trim();
            
            const validationResult = this.validatorRegistry.validate({
              text,
              type: 'variable-declaration',
              context: { variableName }
            });

            if (validationResult.isValid) {
              untranslatedStrings.push({
                text,
                type: 'variable-declaration',
                line: path.node.loc?.start.line || 0,
                column: path.node.loc?.start.column || 0,
                context: `Variable "${variableName}"`,
                isLikelyTranslatable: true,
                suggestedKey: this.generateTranslationKey(text)
              });
            }
          }
        },

        // VALIDATOR 7: Alert/Console Messages for Users
        CallExpression: (path: any) => {
          if (!this.config.analyzeStringLiterals) return;

          const callee = path.node.callee;
          let functionName = '';

          // Handle direct function calls: alert(), confirm(), etc.
          if (callee?.type === 'Identifier') {
            functionName = callee.name;
          }
          // Handle member expressions: console.log(), etc.
          else if (callee?.type === 'MemberExpression' && callee.object?.name && callee.property?.name) {
            functionName = `${callee.object.name}.${callee.property.name}`;
          }

          if (functionName) {
            // Check each argument for string literals
            path.node.arguments?.forEach((arg: any, index: number) => {
              if ((arg?.type === 'Literal' || arg?.type === 'StringLiteral') && typeof arg.value === 'string') {
                const text = arg.value.trim();
                
                const validationResult = this.validatorRegistry.validate({
                  text,
                  type: 'alert-message',
                  context: { 
                    parentContext: { 
                      functionName,
                      argumentIndex: index 
                    } 
                  }
                });

                if (validationResult.isValid) {
                  untranslatedStrings.push({
                    text,
                    type: 'alert-message',
                    line: path.node.loc?.start.line || 0,
                    column: path.node.loc?.start.column || 0,
                    context: `${functionName}() call`,
                    isLikelyTranslatable: true,
                    suggestedKey: this.generateTranslationKey(text)
                  });
                }
              }
            });
          }
        }
      });

    } catch (error) {
      this.logger.error('Failed to analyze untranslated strings:', error);
    }

    return untranslatedStrings;
  }

  /**
   * Find translation function usage
   */
  async findTranslationUsage(ast: any): Promise<TranslationUsage[]> {
    const translationUsage: TranslationUsage[] = [];

    try {
      ASTUtils.traverse(ast, {
        CallExpression: (path: any) => {
          const { node } = path;
          
          // Check if this is a translation function call
          const functionName = this.getCallExpressionName(node);
          if (this.config.translationFunctions!.includes(functionName)) {
            const key = this.extractTranslationKey(node);
            const defaultValue = this.extractDefaultValue(node);
            
            if (key) {
              translationUsage.push({
                functionName,
                key,
                line: node.loc?.start.line || 0,
                column: node.loc?.start.column || 0,
                defaultValue
              });
            }
          }
        }
      });
    } catch (error) {
      this.logger.error('Failed to analyze translation usage:', error);
    }

    return translationUsage;
  }

  /**
   * Detect potential i18n issues
   */
  async detectI18nIssues(
    ast: any, 
    content: string, 
    untranslatedStrings: UntranslatedString[],
    translationUsage: TranslationUsage[]
  ): Promise<I18nIssue[]> {
    const issues: I18nIssue[] = [];

    try {
      // Check for hardcoded strings in user-facing components
      const hardcodedStrings = untranslatedStrings.filter(s => s.isLikelyTranslatable);
      if (hardcodedStrings.length > 0) {
        issues.push({
          type: 'hardcoded-string',
          description: `Found ${hardcodedStrings.length} hardcoded translatable strings`,
          line: hardcodedStrings[0].line,
          suggestion: 'Consider wrapping these strings with translation functions'
        });
      }

      // Check for JSX text that should be translated
      const untranslatedJSX = untranslatedStrings.filter(s => s.type === 'jsx-text' && s.isLikelyTranslatable);
      if (untranslatedJSX.length > 0) {
        issues.push({
          type: 'untranslated-jsx',
          description: `Found ${untranslatedJSX.length} untranslated JSX text elements`,
          line: untranslatedJSX[0].line,
          suggestion: 'Wrap JSX text with translation function: {t("your.key")}'
        });
      }

      // Check for dynamic translation keys (harder to track)
      const dynamicKeys = translationUsage.filter(t => t.key.includes('${') || t.key.includes('+'));
      if (dynamicKeys.length > 0) {
        issues.push({
          type: 'dynamic-key',
          description: `Found ${dynamicKeys.length} dynamic translation keys`,
          line: dynamicKeys[0].line,
          suggestion: 'Consider using static keys for better translation management'
        });
      }
    } catch (error) {
      this.logger.error('Failed to detect i18n issues:', error);
    }

    return issues;
  }

  /**
   * Check if a string is potentially translatable
   */
  // ==========================================================================
  // WHITELIST VALIDATORS - Now using modular validator system
  // ==========================================================================

  /**
   * Get validator registry for external access
   */
  getValidatorRegistry(): ValidatorRegistry {
    return this.validatorRegistry;
  }

  /**
    if (text.length < 2 || text.length > 200) return false;
    
    // Contains common words or sentence structure
    const hasCommonWords = /\b(the|and|or|of|to|in|for|with|by|from|at|on|is|are|was|were|be|been|have|has|had|will|would|could|should|may|might|can|do|does|did|get|got|go|went|come|came|see|saw|know|knew|think|thought|want|need|like|love|help|work|make|take|give|use|find|try|say|tell|ask|call|email|phone|name|time|day|week|month|year|home|page|site|app|user|login|password|error|success|warning|info|save|cancel|ok|yes|no|please|thank|hello|welcome)\b/i.test(text);
    
    // Contains sentence-like structure
    const hasSentenceStructure = /[.!?]$/.test(text.trim()) || /^[A-Z]/.test(text.trim());
    
    // Contains multiple words
    const hasMultipleWords = text.trim().split(/\s+/).length > 1;
    
    return hasCommonWords || hasSentenceStructure || hasMultipleWords;
  }

  /**
   * Check if a string is inside a translation function call
   */

  /**
   * Get the name of a function call
   */
  private getCallExpressionName(node: any): string {
    if (node.callee.type === 'Identifier') {
      return node.callee.name;
    } else if (node.callee.type === 'MemberExpression') {
      return this.getMemberExpressionName(node.callee);
    }
    return '';
  }

  /**
   * Get the full name of a member expression (e.g., i18n.t)
   */
  private getMemberExpressionName(node: any): string {
    if (node.object.type === 'Identifier' && node.property.type === 'Identifier') {
      return `${node.object.name}.${node.property.name}`;
    }
    return '';
  }

  /**
   * Extract translation key from function call
   */
  private extractTranslationKey(node: any): string | null {
    if (node.arguments.length > 0) {
      const firstArg = node.arguments[0];
      if (firstArg.type === 'StringLiteral') {
        return firstArg.value;
      } else if (firstArg.type === 'TemplateLiteral') {
        return firstArg.quasis.map((q: any) => q.value.raw).join('${...}');
      }
    }
    return null;
  }

  /**
   * Extract default value from translation function call
   */
  private extractDefaultValue(node: any): string | undefined {
    // Look for default value in second argument or options object
    if (node.arguments.length > 1) {
      const secondArg = node.arguments[1];
      if (secondArg.type === 'StringLiteral') {
        return secondArg.value;
      } else if (secondArg.type === 'ObjectExpression') {
        const defaultProp = secondArg.properties.find((p: any) => 
          p.key?.name === 'defaultValue' || p.key?.value === 'defaultValue'
        );
        if (defaultProp?.value?.type === 'StringLiteral') {
          return defaultProp.value.value;
        }
      }
    }
    return undefined;
  }

  /**
   * Generate a suggested translation key from text
   */
  private generateTranslationKey(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '.')
      .substring(0, 50);
  }

  /**
   * Get surrounding context for better understanding
   */
  private getNodeContext(path: any): string {
    const parent = path.parent;
    if (parent?.type === 'JSXElement') {
      return `<${parent.openingElement?.name?.name || 'unknown'}>`;
    } else if (parent?.type === 'VariableDeclarator') {
      return `const ${parent.id?.name || 'unknown'}`;
    } else if (parent?.type === 'ObjectProperty') {
      return `${parent.key?.name || parent.key?.value || 'unknown'}: `;
    }
    return '';
  }

  /**
   * Determine if an attribute is a component prop vs HTML attribute
   * Component props are on elements with capitalized names (React components)
   */
  private isComponentProp(path: any): boolean {
    const jsxElement = path.findParent((parent: any) => parent.isJSXElement());
    if (!jsxElement) return false;

    const elementName = jsxElement.node.openingElement?.name?.name;
    if (!elementName || typeof elementName !== 'string') return false;

    // Component names start with uppercase letter
    return /^[A-Z]/.test(elementName);
  }
}
