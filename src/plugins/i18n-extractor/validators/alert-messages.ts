/**
 * VALIDATOR 7: Alert/Console Messages for Users (MEDIUM PRIORITY - Context dependent)
 * Rule: Only alerts/prompts that users see, not debug logs
 * Examples: alert("Please save your work"), confirm("Delete item?")
 */

import { BaseValidator, ValidatorContext, ValidationResult } from './base-validator.js';

export class AlertMessagesValidator extends BaseValidator {
  name = 'alert-messages';
  description = 'Alert/Console Messages for Users - User-facing alerts and prompts';
  priority = 'medium' as const;

  // Whitelist of user-facing alert/console functions
  private readonly userFacingAlertFunctions = new Set([
    'alert',
    'confirm',
    'prompt'
  ]);

  // Functions that are NOT user-facing (developer tools)
  private readonly developerFunctions = new Set([
    'console.log',
    'console.debug',
    'console.info',
    'console.warn',
    'console.error',
    'console.trace',
    'console.time',
    'console.timeEnd',
    'console.assert',
    'console.count',
    'console.dir',
    'console.table'
  ]);

  validate(context: ValidatorContext): ValidationResult {
    const { text, parentContext } = context;

    // Basic validation: must have content and contain letters
    if (!this.basicTextValidation(text)) {
      return { isValid: false, reason: 'Text is empty or contains no letters' };
    }

    // Must have function call context
    if (!parentContext?.functionName) {
      return { isValid: false, reason: 'No function call context provided' };
    }

    const functionName = parentContext.functionName;

    // Skip developer console functions
    if (this.developerFunctions.has(functionName)) {
      return { isValid: false, reason: `Developer function "${functionName}" should not be translated` };
    }

    // Check if it's a user-facing alert function
    if (!this.userFacingAlertFunctions.has(functionName)) {
      return { isValid: false, reason: `Function "${functionName}" is not a user-facing alert` };
    }

    // Additional validation for alert messages
    if (!this.isUserFacingMessage(text)) {
      return { isValid: false, reason: 'Text does not appear to be user-facing message' };
    }

    return { 
      isValid: true, 
      reason: `User-facing ${functionName}() message should be translated` 
    };
  }

  /**
   * Enhanced validation for alert message content
   */
  private isUserFacingMessage(text: string): boolean {
    const trimmed = text.trim();
    
    // Must be non-empty and meaningful
    if (trimmed.length === 0) return false;
    
    // Must be longer than 2 characters (avoid single chars or very short debug strings)
    if (trimmed.length <= 2) return false;

    // Skip technical/debug patterns
    const technicalPatterns = [
      /^(true|false)$/i,                     // Boolean strings
      /^[\d\.,\-\+]+$/,                     // Numbers only
      /^(ok|yes|no|on|off)$/i,              // Very short responses
      /^(test|debug|dev|prod)$/i,           // Environment indicators
      /^[A-Z_]+$/,                          // ALL_CAPS constants
      /^\w+:\w+/,                           // key:value patterns
      /^\[.*\]$/,                           // Array-like strings
      /^\{.*\}$/                            // Object-like strings
    ];

    // Additional check for short technical identifiers
    if (/^[a-z_]+$/i.test(trimmed) && trimmed.length < 5) {
      return false;
    }

    for (const pattern of technicalPatterns) {
      if (typeof pattern === 'boolean') continue;
      if (pattern.test(trimmed)) return false;
    }

    // Skip paths, URLs, and technical strings
    if (text.includes('/') || text.includes('@') || text.includes('\\') || text.includes('://')) {
      return false;
    }

    // Must contain letters (not just symbols/numbers)
    if (!/[a-zA-Z]/.test(text)) {
      return false;
    }

    // Prefer natural language patterns
    const hasSpaces = /\s/.test(text);
    const hasProperLength = trimmed.length >= 5;
    const hasPunctuation = /[.!?:,]/.test(text);
    const hasCapitalization = /[A-Z]/.test(text);
    const hasQuestionMark = /\?/.test(text); // Common in confirmations
    const hasExclamation = /!/.test(text);   // Common in alerts
    
    // Accept if it looks like a user message
    return hasSpaces || hasPunctuation || hasQuestionMark || hasExclamation || 
           (hasProperLength && hasCapitalization);
  }
}
