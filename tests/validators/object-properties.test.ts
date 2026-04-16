import { describe, expect, it } from 'vitest';
import { ObjectPropertiesValidator } from '../../src/plugins/i18n-extractor/validators/object-properties.js';

const v = new ObjectPropertiesValidator();

describe('ObjectPropertiesValidator', () => {
  it.each([
    ['message', 'Hello'],
    ['text', 'Some text'],
    ['label', 'Dashboard'],
    ['title', 'Confirm'],
    ['description', 'A description'],
    ['placeholder', 'Enter name'],
    ['tooltip', 'Click me'],
    ['error', 'Failed to save'],
    ['success', 'Saved'],
    ['warning', 'Careful'],
    ['info', 'FYI'],
  ])('accepts whitelisted property %s', (propertyName, text) => {
    expect(v.validate({ text, propertyName }).isValid).toBe(true);
  });

  it.each([
    ['method', 'POST'],
    ['type', 'button'],
    ['variant', 'primary'],
    ['size', 'large'],
    ['icon', 'home'],
    ['href', '/dashboard'],
  ])('rejects non-whitelisted property %s', (propertyName, text) => {
    const result = v.validate({ text, propertyName });
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('not user-facing');
  });

  it('is case-sensitive on property names', () => {
    expect(v.validate({ text: 'Hello', propertyName: 'Message' }).isValid).toBe(false);
  });

  it('rejects when propertyName is missing', () => {
    expect(v.validate({ text: 'Hello' }).isValid).toBe(false);
  });
});
