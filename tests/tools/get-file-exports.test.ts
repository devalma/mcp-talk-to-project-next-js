import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getFileExports } from '../../src/tools/get-file-exports.js';

let tmp: string;

function write(rel: string, content = '') {
  const full = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'exports-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('getFileExports', () => {
  it('classifies function / component / hook', () => {
    write(
      'src/mod.tsx',
      `export function plain() {}
export function Button() { return <div />; }
export function useAuth() { return null; }`
    );
    const r = getFileExports(tmp, 'src/mod.tsx');
    const byName = Object.fromEntries(r.exports.map((e) => [e.name, e.kind]));
    expect(byName).toEqual({
      plain: 'function',
      Button: 'component',
      useAuth: 'hook',
    });
  });

  it('detects class component vs plain class', () => {
    write(
      'src/mod.tsx',
      `import React from 'react';
export class Plain {}
export class Widget extends React.Component { render() { return null; } }`
    );
    const r = getFileExports(tmp, 'src/mod.tsx');
    const byName = Object.fromEntries(r.exports.map((e) => [e.name, e.kind]));
    expect(byName.Plain).toBe('class');
    expect(byName.Widget).toBe('component');
  });

  it('handles interface, type alias, enum', () => {
    write(
      'src/types.ts',
      `export interface User { id: string }
export type Id = string;
export enum Role { Admin, User }`
    );
    const r = getFileExports(tmp, 'src/types.ts');
    const map = Object.fromEntries(r.exports.map((e) => [e.name, e.kind]));
    expect(map).toEqual({ User: 'interface', Id: 'type', Role: 'enum' });
  });

  it('handles variable exports with inferred kind', () => {
    write(
      'src/mod.tsx',
      `export const plain = 42;
export const Cmp = () => <div />;
export const useThing = () => null;`
    );
    const r = getFileExports(tmp, 'src/mod.tsx');
    const map = Object.fromEntries(r.exports.map((e) => [e.name, e.kind]));
    expect(map).toEqual({ plain: 'variable', Cmp: 'component', useThing: 'hook' });
  });

  it('handles export default function and class', () => {
    write(
      'src/page.tsx',
      `export default function Page() { return <div />; }`
    );
    const r = getFileExports(tmp, 'src/page.tsx');
    expect(r.exports).toHaveLength(1);
    expect(r.exports[0]).toMatchObject({
      name: 'Page',
      kind: 'component',
      default: true,
    });
  });

  it('handles anonymous default export expression', () => {
    write('src/mod.ts', `const x = 1; export default x;`);
    const r = getFileExports(tmp, 'src/mod.ts');
    const def = r.exports.find((e) => e.default);
    expect(def).toBeDefined();
    expect(def!.name).toBe('x');
    expect(def!.kind).toBe('unknown');
  });

  it('handles anonymous arrow default export', () => {
    write('src/mod.tsx', `export default () => <div />;`);
    const r = getFileExports(tmp, 'src/mod.tsx');
    expect(r.exports).toHaveLength(1);
    expect(r.exports[0]).toMatchObject({
      name: 'default',
      kind: 'component',
      default: true,
    });
  });

  it('captures export { X } as unknown without a local declaration', () => {
    write(
      'src/mod.ts',
      `const thing = 1;
export { thing };`
    );
    const r = getFileExports(tmp, 'src/mod.ts');
    // First entry is the `const thing` which is NOT directly exported.
    // Only the export { thing } shows up — kind 'unknown' because the
    // specifier form doesn't carry the declaration inline.
    expect(r.exports).toHaveLength(1);
    expect(r.exports[0]).toMatchObject({ name: 'thing', kind: 'unknown' });
  });

  it('records re-exports with source', () => {
    write(
      'src/barrel.ts',
      `export { Foo } from './foo';
export { Bar as Baz } from './bar';`
    );
    const r = getFileExports(tmp, 'src/barrel.ts');
    expect(r.exports).toHaveLength(2);
    expect(r.exports[0]).toMatchObject({
      name: 'Foo',
      kind: 're-export',
      source: './foo',
    });
    expect(r.exports[0].originalName).toBeUndefined();
    expect(r.exports[1]).toMatchObject({
      name: 'Baz',
      kind: 're-export',
      source: './bar',
      originalName: 'Bar',
    });
  });

  it('records export * from with kind re-export-all', () => {
    write('src/barrel.ts', `export * from './inner';`);
    const r = getFileExports(tmp, 'src/barrel.ts');
    expect(r.exports).toHaveLength(1);
    expect(r.exports[0]).toMatchObject({
      name: '*',
      kind: 're-export-all',
      source: './inner',
    });
  });

  it('records export * as ns from with kind re-export-ns', () => {
    write('src/barrel.ts', `export * as utils from './utils';`);
    const r = getFileExports(tmp, 'src/barrel.ts');
    expect(r.exports).toHaveLength(1);
    expect(r.exports[0]).toMatchObject({
      name: 'utils',
      kind: 're-export-ns',
      source: './utils',
    });
  });

  it('includes line numbers', () => {
    write(
      'src/mod.ts',
      `
export function a() {}
export const b = 1;
`
    );
    const r = getFileExports(tmp, 'src/mod.ts');
    expect(r.exports[0].line).toBeGreaterThan(0);
    expect(r.exports[1].line).toBeGreaterThan(r.exports[0].line);
  });

  it('returns empty exports for a file with no exports', () => {
    write('src/mod.ts', `const x = 1; function y() {}`);
    const r = getFileExports(tmp, 'src/mod.ts');
    expect(r.exports).toEqual([]);
    expect(r.total).toBe(0);
  });

  it('throws when file does not exist', () => {
    expect(() => getFileExports(tmp, 'nope.ts')).toThrow(/File not found/);
  });

  it('handles mixed named + default in one file', () => {
    write(
      'src/page.tsx',
      `export const helper = () => 1;
interface Props { x: string }
export type Slug = string;
export default function Page(props: Props) { return <div />; }`
    );
    const r = getFileExports(tmp, 'src/page.tsx');
    const names = r.exports.map((e) => e.name);
    expect(names).toContain('helper');
    expect(names).toContain('Slug');
    expect(names).toContain('Page');
    const page = r.exports.find((e) => e.name === 'Page');
    expect(page?.default).toBe(true);
    expect(page?.kind).toBe('component');
  });
});
