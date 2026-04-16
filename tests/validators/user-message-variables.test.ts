import { describe, expect, it } from 'vitest';
import { UserMessageVariablesValidator } from '../../src/plugins/i18n-extractor/validators/user-message-variables.js';

const v = new UserMessageVariablesValidator();

describe('UserMessageVariablesValidator', () => {
  it.each([
    ['welcomeMessage', 'Welcome back!'],
    ['errorText', 'Something went wrong'],
    ['successNotification', 'Changes saved'],
    ['warningAlert', 'Be careful'],
    ['pageTitle', 'Dashboard'],
    ['userDescription', 'A user bio'],
    ['buttonLabel', 'Save'],
    ['MESSAGE', 'Shouted text'], // case-insensitive
  ])('accepts variable %s with semantic keyword', (variableName, text) => {
    expect(v.validate({ text, variableName }).isValid).toBe(true);
  });

  it.each([
    ['apiUrl', '/api/users'],
    ['timeout', 'connection timeout reached'], // no semantic fragment, even if text looks user-facing
    ['count', 'Five items'],
    ['isActive', 'Active'],
  ])('rejects variable %s without semantic keyword', (variableName, text) => {
    const result = v.validate({ text, variableName });
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('does not contain semantic keywords');
  });

  it('rejects when variableName is missing', () => {
    expect(v.validate({ text: 'Welcome back' }).isValid).toBe(false);
  });
});
