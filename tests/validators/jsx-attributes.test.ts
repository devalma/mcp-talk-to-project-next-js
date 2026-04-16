import { describe, expect, it } from 'vitest';
import { JSXAttributesValidator } from '../../src/plugins/i18n-extractor/validators/jsx-attributes.js';

const v = new JSXAttributesValidator();

describe('JSXAttributesValidator', () => {
  it('exposes its supported attributes', () => {
    expect(v.getSupportedAttributes().sort()).toEqual(
      ['alt', 'aria-label', 'label', 'placeholder', 'title'].sort()
    );
  });

  it.each([
    ['alt', 'User profile picture'],
    ['title', 'Click to save your changes'],
    ['placeholder', 'Enter your email'],
    ['aria-label', 'Close dialog'],
    ['label', 'Select your country'],
  ])('accepts whitelisted attribute %s', (attributeName, text) => {
    expect(v.validate({ text, attributeName }).isValid).toBe(true);
  });

  it.each([
    ['className', 'flex items-center'],
    ['id', 'submit-button'],
    ['href', '/about'],
    ['type', 'button'],
    ['style', 'color: red'],
  ])('rejects non-whitelisted attribute %s', (attributeName, text) => {
    const result = v.validate({ text, attributeName });
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('not user-facing');
  });

  it('rejects when attributeName is missing', () => {
    const result = v.validate({ text: 'Welcome' });
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('No attribute name provided');
  });

  it('rejects invalid text even with a whitelisted attribute', () => {
    expect(v.validate({ text: '', attributeName: 'alt' }).isValid).toBe(false);
    expect(v.validate({ text: '123', attributeName: 'alt' }).isValid).toBe(false);
  });
});
