/**
 * VALIDATOR 4: User-facing Object Properties (HIGH PRIORITY - Always translate)
 * Rule: Object properties with whitelisted keys
 * Examples: { success: "Data saved!", error: "Failed to save" }, { label: "Dashboard" }
 */

import { BaseValidator, ValidatorContext, ValidationResult } from './base-validator.js';

export class ObjectPropertiesValidator extends BaseValidator {
  name = 'object-properties';
  description = 'User-facing Object Properties - Only whitelisted property keys';
  priority = 'high' as const;

  // Whitelist of user-facing property names according to documentation
  private readonly userFacingProperties = new Set([
    'message',      // Generic messages
    'text',         // Text content
    'label',        // Labels for UI elements
    'title',        // Titles and headers
    'description',  // Descriptions
    'placeholder',  // Placeholder text
    'tooltip',      // Tooltip content
    'error',        // Error messages
    'success',      // Success messages
    'warning',      // Warning messages
    'info'          // Information messages
  ]);

  validate(context: ValidatorContext): ValidationResult {
    const { text, propertyName } = context;

    // Basic validation: must have content and contain letters
    if (!this.basicTextValidation(text)) {
      return { isValid: false, reason: 'Text is empty or contains no letters' };
    }

    // Must have property name
    if (!propertyName) {
      return { isValid: false, reason: 'No property name provided' };
    }

    // Check if property is in the whitelist
    if (!this.userFacingProperties.has(propertyName)) {
      return { isValid: false, reason: `Property "${propertyName}" is not user-facing` };
    }

    return { isValid: true };
  }

  /**
   * Get the list of supported properties
   */
  getSupportedProperties(): string[] {
    return Array.from(this.userFacingProperties);
  }
}
