/**
 * VALIDATOR 2: User-facing JSX Attributes (HIGH PRIORITY - Always translate)
 * Rule: Only specific user-facing attributes
 * Examples: alt="User profile picture", placeholder="Enter your email", title="Click to save"
 */

import { BaseValidator, ValidatorContext, ValidationResult } from './base-validator.js';

export class JSXAttributesValidator extends BaseValidator {
  name = 'jsx-attributes';
  description = 'User-facing JSX Attributes - Only whitelisted attributes';
  priority = 'high' as const;

  // Whitelist of user-facing attributes according to documentation
  private readonly userFacingAttributes = new Set([
    'alt',          // Image alt text
    'title',        // Tooltip text
    'placeholder',  // Input placeholder
    'label',        // Option/form labels
    'aria-label'    // Accessibility labels
  ]);

  validate(context: ValidatorContext): ValidationResult {
    const { text, attributeName } = context;

    // Basic validation: must have content and contain letters
    if (!this.basicTextValidation(text)) {
      return { isValid: false, reason: 'Text is empty or contains no letters' };
    }

    // Must have attribute name
    if (!attributeName) {
      return { isValid: false, reason: 'No attribute name provided' };
    }

    // Check if attribute is in the whitelist
    if (!this.userFacingAttributes.has(attributeName)) {
      return { isValid: false, reason: `Attribute "${attributeName}" is not user-facing` };
    }

    return { isValid: true };
  }

  /**
   * Get the list of supported attributes
   */
  getSupportedAttributes(): string[] {
    return Array.from(this.userFacingAttributes);
  }
}
