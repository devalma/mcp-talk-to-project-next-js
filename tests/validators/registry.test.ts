import { describe, expect, it } from 'vitest';
import {
  ValidatorRegistry,
  ValidationInput,
} from '../../src/plugins/i18n-extractor/validators/registry.js';

describe('ValidatorRegistry', () => {
  const r = new ValidatorRegistry();

  it('registers all 7 default validators', () => {
    const names = r.getAllValidators().map((v) => v.name);
    expect(names.sort()).toEqual(
      [
        'jsx-text-content',
        'jsx-attributes',
        'user-message-variables',
        'object-properties',
        'form-validation',
        'component-props',
        'alert-messages',
      ].sort()
    );
  });

  it('getSummary returns metadata for every validator', () => {
    const summary = r.getSummary();
    expect(summary).toHaveLength(7);
    for (const entry of summary) {
      expect(entry).toMatchObject({
        name: expect.any(String),
        description: expect.any(String),
        priority: expect.stringMatching(/^(high|medium|low)$/),
      });
    }
  });

  describe('routing', () => {
    const cases: Array<[ValidationInput, string]> = [
      [{ text: 'Hello', type: 'jsx-text', context: {} }, 'jsx-text-content'],
      [
        { text: 'Profile picture', type: 'jsx-attribute', context: { attributeName: 'alt' } },
        'jsx-attributes',
      ],
      [
        {
          text: 'Welcome',
          type: 'variable-declaration',
          context: { variableName: 'welcomeMessage' },
        },
        'user-message-variables',
      ],
      [
        { text: 'Hello', type: 'object-property', context: { propertyName: 'message' } },
        'object-properties',
      ],
      [
        {
          text: 'This field is required',
          type: 'form-validation',
          context: { propertyName: 'required' },
        },
        'form-validation',
      ],
      [
        {
          text: 'Confirm Delete',
          type: 'component-prop',
          context: { attributeName: 'title' },
        },
        'component-props',
      ],
      [
        {
          text: 'Are you sure?',
          type: 'alert-message',
          context: { parentContext: { functionName: 'alert' } },
        },
        'alert-messages',
      ],
    ];

    it.each(cases)('type=%o → validator=%s', (input, expectedValidator) => {
      const out = r.validate(input);
      expect(out.validator).toBe(expectedValidator);
      expect(out.isValid).toBe(true);
    });
  });

  it('returns unknown-validator output for unknown type', () => {
    const out = r.validate({ text: 'hi', type: 'nope' as any, context: {} });
    expect(out.isValid).toBe(false);
    expect(out.validator).toBe('unknown');
    expect(out.reason).toContain('Unknown validation type');
  });

  it('register() replaces an existing validator with the same name', () => {
    const registry = new ValidatorRegistry();
    const before = registry.getValidator('jsx-text-content');
    expect(before).toBeDefined();

    class Stub extends (before!.constructor as any) {
      name = 'jsx-text-content';
      validate() {
        return { isValid: false, reason: 'stubbed' };
      }
    }

    registry.register(new Stub());
    const result = registry.validate({ text: 'Hello', type: 'jsx-text', context: {} });
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('stubbed');
  });
});
