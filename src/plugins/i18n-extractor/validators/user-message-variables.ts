/**
 * VALIDATOR 3: User Message Variables (HIGH PRIORITY - Always translate)
 * Rule: Variables with semantic names containing specific keywords
 * Examples: const welcomeMessage = "Welcome back!", const errorText = "Something went wrong"
 */

import { BaseValidator, ValidatorContext, ValidationResult } from './base-validator.js';

export class UserMessageVariablesValidator extends BaseValidator {
  name = 'user-message-variables';
  description = 'User Message Variables - Variables with semantic names containing keywords';
  priority = 'high' as const;

  // Whitelist of semantic variable name patterns according to documentation
  private readonly semanticPatterns = [
    'message',      // welcomeMessage, errorMessage, etc.
    'text',         // errorText, welcomeText, etc.
    'notification', // successNotification, etc.
    'alert',        // warningAlert, etc.
    'title',        // pageTitle, modalTitle, etc.
    'description',  // userDescription, etc.
    'label'         // buttonLabel, fieldLabel, etc.
  ];

  validate(context: ValidatorContext): ValidationResult {
    const { text, variableName } = context;

    // Basic validation: must have content and contain letters
    if (!this.basicTextValidation(text)) {
      return { isValid: false, reason: 'Text is empty or contains no letters' };
    }

    // Must have variable name
    if (!variableName) {
      return { isValid: false, reason: 'No variable name provided' };
    }

    // Check if variable name contains any semantic pattern (case-insensitive)
    const lowerVarName = variableName.toLowerCase();
    const matchedPattern = this.semanticPatterns.find(pattern => lowerVarName.includes(pattern));

    if (!matchedPattern) {
      return { 
        isValid: false, 
        reason: `Variable "${variableName}" does not contain semantic keywords: ${this.semanticPatterns.join(', ')}` 
      };
    }

    return { isValid: true };
  }

  /**
   * Get the list of supported semantic patterns
   */
  getSemanticPatterns(): string[] {
    return [...this.semanticPatterns];
  }
}
