import { describe, expect, it } from 'vitest';
import { AlertMessagesValidator } from '../../src/plugins/i18n-extractor/validators/alert-messages.js';

const v = new AlertMessagesValidator();

describe('AlertMessagesValidator', () => {
  it.each([
    ['alert', 'Please save your work before leaving'],
    ['confirm', 'Do you want to delete this item?'],
    ['prompt', 'Enter your name'],
  ])('accepts user-facing function %s', (functionName, text) => {
    const result = v.validate({ text, parentContext: { functionName } });
    expect(result.isValid).toBe(true);
  });

  it.each([
    'console.log',
    'console.debug',
    'console.info',
    'console.warn',
    'console.error',
  ])('rejects developer function %s', (functionName) => {
    const result = v.validate({
      text: 'Debug: user clicked button',
      parentContext: { functionName },
    });
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain(functionName);
  });

  it('rejects unknown functions', () => {
    const result = v.validate({
      text: 'Some message to users',
      parentContext: { functionName: 'customLog' },
    });
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('not a user-facing alert');
  });

  it('rejects when parentContext.functionName is missing', () => {
    const result = v.validate({ text: 'Hello' });
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('No function call context provided');
  });

  describe('message heuristic (alert() context)', () => {
    it.each([
      'ok',
      'no',
      'true',
      'test',
      '[error]',
      '{status}',
      '123.45',
      'https://example.com',
      '/path/to/file',
    ])('rejects technical alert content %j', (text) => {
      const result = v.validate({ text, parentContext: { functionName: 'alert' } });
      expect(result.isValid).toBe(false);
    });

    it.each([
      'Are you sure?',
      'Item deleted!',
      'Please confirm your choice',
      'Error: invalid input',
    ])('accepts natural-language alert content %j', (text) => {
      const result = v.validate({ text, parentContext: { functionName: 'alert' } });
      expect(result.isValid).toBe(true);
    });
  });
});
