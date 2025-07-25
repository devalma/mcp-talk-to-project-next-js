/**
 * VALIDATOR 6: User-facing Props in Components (MEDIUM PRIORITY - Context dependent)
 * Rule: Props that contain user-facing text in components
 * Examples: <Modal title="Confirm Delete" />, <Toast text="Success!" />
 */

import { BaseValidator, ValidatorContext, ValidationResult } from './base-validator.js';

export class ComponentPropsValidator extends BaseValidator {
  name = 'component-props';
  description = 'User-facing Props in Components - Props that display text to users';
  priority = 'medium' as const;

  // Whitelist of user-facing prop names according to documentation
  private readonly userFacingProps = new Set([
    'title',
    'message', 
    'text',
    'content',
    'description',
    'confirmText',
    'cancelText', 
    'submitText',
    'tooltip',
    'placeholder',
    'label',
    'errorText',
    'successText',
    'warningText',
    'infoText',
    'helperText',
    'hintText',
    'statusText',
    'actionText',
    'buttonText'
  ]);

  validate(context: ValidatorContext): ValidationResult {
    const { text, attributeName } = context;

    // Basic validation: must have content and contain letters
    if (!this.basicTextValidation(text)) {
      return { isValid: false, reason: 'Text is empty or contains no letters' };
    }

    // Must have attribute name for component props
    if (!attributeName) {
      return { isValid: false, reason: 'No attribute name provided' };
    }

    // Check if attribute is a user-facing prop
    if (!this.userFacingProps.has(attributeName)) {
      return { isValid: false, reason: `Prop "${attributeName}" is not user-facing` };
    }

    // Additional validation for component props
    if (!this.isUserFacingText(text)) {
      return { isValid: false, reason: 'Text does not appear to be user-facing content' };
    }

    return { 
      isValid: true, 
      reason: `User-facing prop "${attributeName}" contains translatable text` 
    };
  }

  /**
   * Enhanced validation for component prop text content
   */
  private isUserFacingText(text: string): boolean {
    const trimmed = text.trim();
    
    // Must be non-empty and meaningful
    if (trimmed.length === 0) return false;
    
    // Must be longer than 1 character (avoid single chars)
    if (trimmed.length === 1) return false;

    // Skip technical/system values
    const technicalPatterns = [
      /^(true|false)$/i,                     // Boolean strings
      /^[\d\.,]+$/,                         // Numbers only
      /^#[0-9a-fA-F]{3,8}$/,               // Color codes
      /^(left|right|top|bottom|center)$/i,  // Position values
      /^(sm|md|lg|xl|xs)$/i,               // Size values
      /^(none|auto|inherit|initial)$/i      // CSS values
    ];

    // Additional check for short single words
    if (/^[a-z]+$/i.test(trimmed) && trimmed.length < 4) {
      return false;
    }

    if (technicalPatterns.some(pattern => pattern.test(trimmed))) {
      return false;
    }

    // Skip paths and technical strings
    if (text.includes('/') || text.includes('@') || text.includes('\\')) {
      return false;
    }

    // Must contain letters (not just symbols/numbers)
    if (!/[a-zA-Z]/.test(text)) {
      return false;
    }

    // Prefer natural language patterns
    const hasSpaces = /\s/.test(text);
    const hasProperLength = trimmed.length >= 3;
    const hasPunctuation = /[.!?:,]/.test(text);
    const hasCapitalization = /[A-Z]/.test(text);
    
    // Accept if it looks like natural language
    return hasSpaces || hasPunctuation || (hasProperLength && hasCapitalization);
  }
}
