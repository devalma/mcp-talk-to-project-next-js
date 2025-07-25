/**
 * VALIDATOR 1: JSX Text Content (HIGH PRIORITY - Always translate)
 * Rule: All direct text content within JSX elements
 * Examples: <h1>Welcome</h1>, <p>Loading...</p>, <div>Error: Could not save data</div>
 */

import { BaseValidator, ValidatorContext, ValidationResult } from './base-validator.js';

export class JSXTextContentValidator extends BaseValidator {
  name = 'jsx-text-content';
  description = 'JSX Text Content - Always translate direct text within JSX elements';
  priority = 'high' as const;

  validate(context: ValidatorContext): ValidationResult {
    const { text } = context;

    // Basic validation: must have content and contain letters
    if (!this.basicTextValidation(text)) {
      return { isValid: false, reason: 'Text is empty or contains no letters' };
    }

    // JSX text content is always user-facing by definition
    // According to whitelist rule: "All direct text content within JSX elements"
    return { isValid: true };
  }
}
