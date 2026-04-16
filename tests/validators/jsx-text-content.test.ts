import { describe, expect, it } from 'vitest';
import { JSXTextContentValidator } from '../../src/plugins/i18n-extractor/validators/jsx-text-content.js';

const v = new JSXTextContentValidator();

describe('JSXTextContentValidator', () => {
  it('has the expected metadata', () => {
    expect(v.name).toBe('jsx-text-content');
    expect(v.priority).toBe('high');
  });

  it.each([
    'Welcome to our app',
    'Loading...',
    'Error: Could not save data',
    'x', // single letter is fine per basicTextValidation
  ])('accepts user-facing text %j', (text) => {
    expect(v.validate({ text }).isValid).toBe(true);
  });

  it.each([
    ['', 'empty'],
    ['   ', 'whitespace-only (no letters)'],
    ['12345', 'digits only'],
    ['!@#$', 'punctuation only'],
  ])('rejects %j (%s)', (text) => {
    const result = v.validate({ text });
    expect(result.isValid).toBe(false);
    expect(result.reason).toBeDefined();
  });
});
