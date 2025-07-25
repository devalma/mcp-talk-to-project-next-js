/**
 * VALIDATOR 5: Form Validation Messages (HIGH PRIORITY - Always translate)
 * Rule: Variables and object properties containing validation/error messages
 * Examples: { required: "This field is required" }, const emailError = "Invalid email"
 */

import { BaseValidator, ValidatorContext, ValidationResult } from './base-validator.js';

export class FormValidationValidator extends BaseValidator {
  name = 'form-validation';
  description = 'Form Validation Messages - Validation and error message strings';
  priority = 'high' as const;

  // Validation-related property names
  private readonly validationProperties = new Set([
    'required',
    'email',
    'password',
    'minLength',
    'maxLength',
    'pattern',
    'min',
    'max',
    'invalid',
    'valid',
    'format',
    'match',
    'confirm',
    'unique',
    'exists'
  ]);

  // Validation-related variable name patterns
  private readonly validationVariablePatterns = [
    /validation/i,
    /error/i,
    /invalid/i,
    /required/i,
    /check/i,
    /verify/i,
    /confirm/i,
    /validate/i
  ];

  validate(context: ValidatorContext): ValidationResult {
    const { text, propertyName, variableName } = context;

    // Basic validation: must have content and contain letters
    if (!this.basicTextValidation(text)) {
      return { isValid: false, reason: 'Text is empty or contains no letters' };
    }

    // Check if it's a validation property
    if (propertyName && this.validationProperties.has(propertyName)) {
      return { isValid: true };
    }

    // Check if it's a validation-related variable
    if (variableName && this.isValidationVariable(variableName)) {
      return { isValid: true };
    }

    // Check content patterns for validation messages
    if (this.isValidationMessage(text)) {
      return { isValid: true };
    }

    return { isValid: false, reason: 'Not a validation message' };
  }

  /**
   * Check if variable name suggests validation content
   */
  private isValidationVariable(variableName: string): boolean {
    return this.validationVariablePatterns.some(pattern => 
      pattern.test(variableName)
    );
  }

  /**
   * Check if text content looks like a validation message
   */
  private isValidationMessage(text: string): boolean {
    // Common validation message patterns
    const validationPatterns = [
      /required/i,
      /invalid/i,
      /must be/i,
      /cannot be/i,
      /should be/i,
      /please enter/i,
      /please provide/i,
      /field is/i,
      /characters?/i,
      /minimum/i,
      /maximum/i,
      /at least/i,
      /no more than/i,
      /does not match/i,
      /already exists/i,
      /not found/i,
      /too short/i,
      /too long/i,
      /format/i
    ];

    return validationPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Get the list of supported validation properties
   */
  getSupportedProperties(): string[] {
    return Array.from(this.validationProperties);
  }

  /**
   * Get the list of validation variable patterns
   */
  getValidationPatterns(): string[] {
    return this.validationVariablePatterns.map(pattern => pattern.source);
  }
}
