/**
 * I18n Validators - Modular validator system for detecting translatable strings
 */

// Base validator interface and abstract class
export { BaseValidator, ValidatorContext, ValidationResult } from './base-validator.js';

// Individual validators
export { JSXTextContentValidator } from './jsx-text-content.js';
export { JSXAttributesValidator } from './jsx-attributes.js';
export { UserMessageVariablesValidator } from './user-message-variables.js';
export { ObjectPropertiesValidator } from './object-properties.js';
export { FormValidationValidator } from './form-validation.js';
export { ComponentPropsValidator } from './component-props.js';
export { AlertMessagesValidator } from './alert-messages.js';

// Validator registry
export { 
  ValidatorRegistry, 
  ValidationInput, 
  ValidationOutput 
} from './registry.js';
