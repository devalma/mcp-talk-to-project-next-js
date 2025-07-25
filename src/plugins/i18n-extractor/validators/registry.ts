/**
 * Validator Registry - Central management of all i18n validators
 */

import { BaseValidator, ValidatorContext } from './base-validator.js';
import { JSXTextContentValidator } from './jsx-text-content.js';
import { JSXAttributesValidator } from './jsx-attributes.js';
import { UserMessageVariablesValidator } from './user-message-variables.js';
import { ObjectPropertiesValidator } from './object-properties.js';
import { FormValidationValidator } from './form-validation.js';
import { ComponentPropsValidator } from './component-props.js';
import { AlertMessagesValidator } from './alert-messages.js';

export interface ValidationInput {
  text: string;
  type: 'jsx-text' | 'jsx-attribute' | 'variable-declaration' | 'object-property' | 'form-validation' | 'component-prop' | 'alert-message';
  context: {
    attributeName?: string;
    variableName?: string;
    propertyName?: string;
    parentContext?: any;
  };
}

export interface ValidationOutput {
  isValid: boolean;
  validator: string;
  type: string;
  reason?: string;
}

export class ValidatorRegistry {
  private validators: Map<string, BaseValidator>;

  constructor() {
    this.validators = new Map();
    this.registerDefaultValidators();
  }

  /**
   * Register all default validators
   */
  private registerDefaultValidators(): void {
    this.register(new JSXTextContentValidator());
    this.register(new JSXAttributesValidator());
    this.register(new UserMessageVariablesValidator());
    this.register(new ObjectPropertiesValidator());
    this.register(new FormValidationValidator());
    this.register(new ComponentPropsValidator());
    this.register(new AlertMessagesValidator());
  }

  /**
   * Register a new validator
   */
  register(validator: BaseValidator): void {
    this.validators.set(validator.name, validator);
  }

  /**
   * Get a validator by name
   */
  getValidator(name: string): BaseValidator | undefined {
    return this.validators.get(name);
  }

  /**
   * Get all registered validators
   */
  getAllValidators(): BaseValidator[] {
    return Array.from(this.validators.values());
  }

  /**
   * Validate a string input based on its type
   */
  validate(input: ValidationInput): ValidationOutput {
    const { text, type, context } = input;

    let validator: BaseValidator | undefined;
    let validatorContext: ValidatorContext;

    switch (type) {
      case 'jsx-text':
        validator = this.getValidator('jsx-text-content');
        validatorContext = { text };
        break;

      case 'jsx-attribute':
        validator = this.getValidator('jsx-attributes');
        validatorContext = { text, attributeName: context.attributeName };
        break;

      case 'variable-declaration':
        validator = this.getValidator('user-message-variables');
        validatorContext = { text, variableName: context.variableName };
        break;

      case 'object-property':
        validator = this.getValidator('object-properties');
        validatorContext = { text, propertyName: context.propertyName };
        break;

      case 'form-validation':
        validator = this.getValidator('form-validation');
        validatorContext = { text, propertyName: context.propertyName };
        break;

      case 'component-prop':
        validator = this.getValidator('component-props');
        validatorContext = { text, attributeName: context.attributeName };
        break;

      case 'alert-message':
        validator = this.getValidator('alert-messages');
        validatorContext = { text, parentContext: context.parentContext };
        break;

      default:
        return {
          isValid: false,
          validator: 'unknown',
          type,
          reason: `Unknown validation type: ${type}`
        };
    }

    if (!validator) {
      return {
        isValid: false,
        validator: 'not-found',
        type,
        reason: `No validator found for type: ${type}`
      };
    }

    const result = validator.validate(validatorContext);

    return {
      isValid: result.isValid,
      validator: validator.name,
      type,
      reason: result.reason
    };
  }

  /**
   * Get summary of all validators
   */
  getSummary(): Array<{ name: string; description: string; priority: string }> {
    return this.getAllValidators().map(v => ({
      name: v.name,
      description: v.description,
      priority: v.priority
    }));
  }
}
