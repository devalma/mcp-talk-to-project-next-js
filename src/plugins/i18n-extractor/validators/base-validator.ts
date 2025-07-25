/**
 * Base Validator Interface for I18n String Validation
 */

export interface ValidatorContext {
  text: string;
  attributeName?: string;
  variableName?: string;
  propertyName?: string;
  parentContext?: any;
}

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

export abstract class BaseValidator {
  abstract name: string;
  abstract description: string;
  abstract priority: 'high' | 'medium' | 'low';

  /**
   * Basic text validation - must have content and contain letters
   */
  protected basicTextValidation(text: string): boolean {
    if (!text || text.length < 1) return false;
    if (!/[a-zA-Z]/.test(text)) return false;
    return true;
  }

  /**
   * Main validation method - to be implemented by each validator
   */
  abstract validate(context: ValidatorContext): ValidationResult;

  /**
   * Get the suggested translation key for this text
   */
  protected generateTranslationKey(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }
}
