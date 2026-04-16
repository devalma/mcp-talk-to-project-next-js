import { describe, expect, it } from 'vitest';
import { FormValidationValidator } from '../../src/plugins/i18n-extractor/validators/form-validation.js';

const v = new FormValidationValidator();

describe('FormValidationValidator', () => {
  describe('property-based acceptance', () => {
    it.each([
      ['required', 'This field is required'],
      ['email', 'Please enter a valid email'],
      ['password', 'Password must be at least 8 characters'],
      ['minLength', 'Too short'],
      ['maxLength', 'Too long'],
      ['pattern', 'Does not match'],
      ['invalid', 'Invalid value'],
      ['confirm', 'Passwords do not match'],
    ])('accepts validation property %s', (propertyName, text) => {
      expect(v.validate({ text, propertyName }).isValid).toBe(true);
    });
  });

  describe('variable-name-based acceptance', () => {
    it.each([
      'validationError',
      'errorMessage',
      'invalidFieldText',
      'requiredMessage',
      'checkResult',
      'verifyStatus',
      'confirmDialogText',
      'validateInput',
    ])('accepts variable name containing validation keyword: %s', (variableName) => {
      expect(v.validate({ text: 'Some message', variableName }).isValid).toBe(true);
    });
  });

  describe('content-pattern-based acceptance', () => {
    it.each([
      'This field is required',
      'Please enter a valid email',
      'Must be at least 8 characters',
      'Cannot be empty',
      'Does not match',
      'Already exists',
    ])('accepts text matching validation pattern: %j', (text) => {
      expect(v.validate({ text }).isValid).toBe(true);
    });
  });

  describe('rejection', () => {
    it('rejects text without a validation signal', () => {
      const result = v.validate({ text: 'Just a greeting' });
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Not a validation message');
    });

    it('rejects empty text even with a validation property', () => {
      expect(v.validate({ text: '', propertyName: 'required' }).isValid).toBe(false);
    });
  });
});
