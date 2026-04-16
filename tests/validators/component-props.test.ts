import { describe, expect, it } from 'vitest';
import { ComponentPropsValidator } from '../../src/plugins/i18n-extractor/validators/component-props.js';

const v = new ComponentPropsValidator();

describe('ComponentPropsValidator', () => {
  it.each([
    ['title', 'Confirm Delete'],
    ['message', 'Are you sure you want to delete this item?'],
    ['text', 'Item deleted successfully'],
    ['content', 'Click to edit this field'],
    ['confirmText', 'Delete'], // 6 chars + capital
    ['cancelText', 'Cancel'],
    ['helperText', 'This field is optional'],
    ['buttonText', 'Submit form'],
  ])('accepts whitelisted prop %s with natural-language text', (attributeName, text) => {
    expect(v.validate({ text, attributeName }).isValid).toBe(true);
  });

  it.each([
    ['className', 'flex items-center'],
    ['variant', 'Primary action'],
    ['size', 'Large'],
    ['onClick', 'Handler'],
  ])('rejects non-whitelisted prop %s', (attributeName, text) => {
    const result = v.validate({ text, attributeName });
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('not user-facing');
  });

  describe('text content heuristic', () => {
    it.each([
      ['title', 'true'], // boolean string
      ['title', 'sm'], // size value
      ['title', 'left'], // position
      ['title', '#ff0000'], // color code
      ['title', '123.45'], // numbers
      ['title', 'foo'], // short single word, no caps/space/punctuation
      ['title', '/path/to/thing'], // path
      ['title', '@module/name'], // import path
    ])('rejects prop %s with non-user-facing value %j', (attributeName, text) => {
      const result = v.validate({ text, attributeName });
      expect(result.isValid).toBe(false);
    });
  });

  it('rejects when attributeName is missing', () => {
    expect(v.validate({ text: 'Hello there' }).isValid).toBe(false);
  });
});
