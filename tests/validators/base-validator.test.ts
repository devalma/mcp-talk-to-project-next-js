import { describe, expect, it } from 'vitest';
import {
  BaseValidator,
  ValidatorContext,
  ValidationResult,
} from '../../src/plugins/i18n-extractor/validators/base-validator.js';

class TestValidator extends BaseValidator {
  name = 'test';
  description = 'test';
  priority = 'low' as const;

  validate(_: ValidatorContext): ValidationResult {
    return { isValid: true };
  }

  exposeBasicTextValidation(text: string) {
    return this.basicTextValidation(text);
  }

  exposeGenerateTranslationKey(text: string) {
    return this.generateTranslationKey(text);
  }
}

const v = new TestValidator();

describe('BaseValidator.basicTextValidation', () => {
  it.each([
    ['hello', true],
    ['Hi!', true],
    ['a', true],
    ['', false],
    ['   ', false], // has length but no letters → fails letter check
    ['12345', false],
    ['!@#$%', false],
    ['123 456', false],
  ])('basicTextValidation(%j) → %s', (input, expected) => {
    expect(v.exposeBasicTextValidation(input)).toBe(expected);
  });

  it('rejects empty string explicitly', () => {
    expect(v.exposeBasicTextValidation('')).toBe(false);
  });
});

describe('BaseValidator.generateTranslationKey', () => {
  it('lowercases and underscores spaces', () => {
    expect(v.exposeGenerateTranslationKey('Hello World')).toBe('hello_world');
  });

  it('strips non-alphanumeric characters', () => {
    expect(v.exposeGenerateTranslationKey('Hello, World!')).toBe('hello_world');
  });

  it('truncates to 50 characters', () => {
    const long = 'a'.repeat(80);
    expect(v.exposeGenerateTranslationKey(long)).toHaveLength(50);
  });

  it('collapses runs of whitespace to single underscore', () => {
    expect(v.exposeGenerateTranslationKey('foo   bar')).toBe('foo_bar');
  });
});
