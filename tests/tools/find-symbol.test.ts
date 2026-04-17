import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findSymbol, findSymbolTool } from '../../src/tools/find-symbol.js';
import { clearAstCache, getAstCacheStats } from '../../src/tools/shared/ast-cache.js';

let tmp: string;

function write(rel: string, content = '') {
  const full = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

beforeEach(() => {
  clearAstCache();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'findsym-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('findSymbol - components', () => {
  it('classifies PascalCase function returning JSX as component', async () => {
    write(
      'src/Button.tsx',
      `export function Button() { return <button>click</button>; }`
    );
    const r = await findSymbol(tmp, 'Button');
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0].kind).toBe('component');
    expect(r.matches[0].exported).toBe(true);
    expect(r.matches[0].returnsJsx).toBe(true);
    expect(r.matches[0].file).toBe('src/Button.tsx');
  });

  it('classifies arrow component assigned to const', async () => {
    write(
      'src/Card.tsx',
      `export const Card = () => <div>card</div>;`
    );
    const r = await findSymbol(tmp, 'Card');
    expect(r.matches[0].kind).toBe('component');
    expect(r.matches[0].returnsJsx).toBe(true);
  });

  it('classifies JSX fragment-returning component', async () => {
    write(
      'src/Layout.tsx',
      `export function Layout() { return <><div/><span/></>; }`
    );
    const r = await findSymbol(tmp, 'Layout');
    expect(r.matches[0].kind).toBe('component');
  });

  it('does NOT classify PascalCase without JSX as component', async () => {
    write(
      'src/Utils.ts',
      `export function MakeThing() { return { x: 1 }; }`
    );
    const r = await findSymbol(tmp, 'MakeThing');
    expect(r.matches[0].kind).toBe('function');
  });

  it('classifies class component extending React.Component', async () => {
    write(
      'src/Widget.tsx',
      `import React from 'react';
export class Widget extends React.Component { render() { return null; } }`
    );
    const r = await findSymbol(tmp, 'Widget');
    expect(r.matches[0].kind).toBe('component');
  });

  it('classifies class extending PureComponent as component', async () => {
    write(
      'src/Pure.tsx',
      `import { PureComponent } from 'react';
export class Pure extends PureComponent { render() { return null; } }`
    );
    const r = await findSymbol(tmp, 'Pure');
    expect(r.matches[0].kind).toBe('component');
  });
});

describe('findSymbol - hooks', () => {
  it('classifies use<Name> as hook even if body has no JSX', async () => {
    write(
      'src/hooks/useAuth.ts',
      `export function useAuth() { return { user: null }; }`
    );
    const r = await findSymbol(tmp, 'useAuth');
    expect(r.matches[0].kind).toBe('hook');
  });

  it('does not classify "used" or "user" as hook (case matters)', async () => {
    write('src/utils.ts', `export function used() { return true; }`);
    const r = await findSymbol(tmp, 'used');
    expect(r.matches[0].kind).toBe('function');
  });

  it('classifies arrow hook assigned to const', async () => {
    write('src/hooks.ts', `export const useCounter = () => ({ count: 0 });`);
    const r = await findSymbol(tmp, 'useCounter');
    expect(r.matches[0].kind).toBe('hook');
  });
});

describe('findSymbol - other declarations', () => {
  it('finds interfaces', async () => {
    write('src/types.ts', `export interface User { id: string }`);
    const r = await findSymbol(tmp, 'User');
    expect(r.matches[0].kind).toBe('interface');
    expect(r.matches[0].exported).toBe(true);
  });

  it('finds type aliases', async () => {
    write('src/types.ts', `export type Role = 'admin' | 'user';`);
    const r = await findSymbol(tmp, 'Role');
    expect(r.matches[0].kind).toBe('type');
  });

  it('finds plain classes', async () => {
    write('src/services/Auth.ts', `export class Auth { signIn() {} }`);
    const r = await findSymbol(tmp, 'Auth');
    expect(r.matches[0].kind).toBe('class');
  });

  it('finds top-level variable declarations', async () => {
    write('src/config.ts', `export const API_URL = '/api';`);
    const r = await findSymbol(tmp, 'API_URL');
    expect(r.matches[0].kind).toBe('variable');
  });
});

describe('findSymbol - export metadata', () => {
  it('flags default exports', async () => {
    write(
      'src/Page.tsx',
      `export default function Page() { return <div/>; }`
    );
    const r = await findSymbol(tmp, 'Page');
    expect(r.matches[0].exported).toBe(true);
    expect(r.matches[0].default).toBe(true);
  });

  it('flags non-exported declarations', async () => {
    write(
      'src/internal.ts',
      `function secret() { return 42; }
export function publicFn() { return secret(); }`
    );
    const r = await findSymbol(tmp, 'secret');
    expect(r.matches[0].exported).toBe(false);
    expect(r.matches[0].default).toBe(false);
  });
});

describe('findSymbol - multi-file & filters', () => {
  it('returns all matches across files', async () => {
    write('src/a/Button.tsx', `export function Button() { return <button/>; }`);
    write('src/b/Button.tsx', `export function Button() { return <button/>; }`);
    const r = await findSymbol(tmp, 'Button');
    expect(r.total).toBe(2);
    const files = r.matches.map((m) => m.file).sort();
    expect(files).toEqual(['src/a/Button.tsx', 'src/b/Button.tsx']);
  });

  it('respects the kind filter', async () => {
    write('src/Button.tsx', `export function Button() { return <button/>; }`);
    write('src/ButtonProps.ts', `export interface Button { label: string }`);
    const all = await findSymbol(tmp, 'Button');
    expect(all.total).toBe(2);

    const onlyComponents = await findSymbol(tmp, 'Button', 'component');
    expect(onlyComponents.total).toBe(1);
    expect(onlyComponents.matches[0].kind).toBe('component');

    const onlyInterfaces = await findSymbol(tmp, 'Button', 'interface');
    expect(onlyInterfaces.matches[0].kind).toBe('interface');
  });

  it('excludes node_modules and dist', async () => {
    write('src/Foo.ts', `export function Foo() {}`);
    write('node_modules/junk/Foo.ts', `export function Foo() {}`);
    write('dist/Foo.js', `export function Foo() {}`);

    const r = await findSymbol(tmp, 'Foo');
    expect(r.total).toBe(1);
    expect(r.matches[0].file).toBe('src/Foo.ts');
  });

  it('returns zero matches cleanly', async () => {
    write('src/a.ts', `export const x = 1;`);
    const r = await findSymbol(tmp, 'NotThere');
    expect(r.total).toBe(0);
    expect(r.matches).toEqual([]);
    expect(r.hasMore).toBe(false);
    expect(r.nextOffset).toBeNull();
  });
});

describe('findSymbol - pagination', () => {
  // 5 matches in deterministic (file, line) order.
  function writeFiveMatches() {
    write('src/a/Btn.tsx', `export function Btn() { return <div/>; }`);
    write('src/b/Btn.tsx', `export function Btn() { return <div/>; }`);
    write('src/c/Btn.tsx', `export function Btn() { return <div/>; }`);
    write('src/d/Btn.tsx', `export function Btn() { return <div/>; }`);
    write('src/e/Btn.tsx', `export function Btn() { return <div/>; }`);
  }

  it('default page returns everything and reports no more pages', async () => {
    writeFiveMatches();
    const r = await findSymbol(tmp, 'Btn');
    expect(r.total).toBe(5);
    expect(r.matches).toHaveLength(5);
    expect(r.hasMore).toBe(false);
    expect(r.nextOffset).toBeNull();
  });

  it('paged call returns the requested slice and nextOffset', async () => {
    writeFiveMatches();
    const r = await findSymbol(tmp, 'Btn', 'any', 2, 0);
    expect(r.matches).toHaveLength(2);
    expect(r.total).toBe(5);
    expect(r.hasMore).toBe(true);
    expect(r.nextOffset).toBe(2);
  });

  it('last partial page clears hasMore', async () => {
    writeFiveMatches();
    const r = await findSymbol(tmp, 'Btn', 'any', 2, 4);
    expect(r.matches).toHaveLength(1);
    expect(r.hasMore).toBe(false);
    expect(r.nextOffset).toBeNull();
  });

  it('offset past the end returns an empty slice', async () => {
    writeFiveMatches();
    const r = await findSymbol(tmp, 'Btn', 'any', 2, 10);
    expect(r.matches).toEqual([]);
    expect(r.total).toBe(5);
    expect(r.hasMore).toBe(false);
  });

  it('paging through the full list yields the full list in order', async () => {
    writeFiveMatches();
    const p1 = await findSymbol(tmp, 'Btn', 'any', 2, 0);
    const p2 = await findSymbol(tmp, 'Btn', 'any', 2, 2);
    const p3 = await findSymbol(tmp, 'Btn', 'any', 2, 4);
    const all = await findSymbol(tmp, 'Btn');
    expect([...p1.matches, ...p2.matches, ...p3.matches]).toEqual(all.matches);
  });

  it('handler rejects limit <= 0 and offset < 0', async () => {
    const ctx = { resolvedProjectPath: tmp, pluginManager: {} as any };
    const badLimit = await findSymbolTool.handler({ name: 'X', limit: 0 }, ctx);
    expect(badLimit.isError).toBe(true);
    expect((badLimit.content[0] as any).text).toMatch(/limit/);

    const negLimit = await findSymbolTool.handler({ name: 'X', limit: -1 }, ctx);
    expect(negLimit.isError).toBe(true);

    const negOffset = await findSymbolTool.handler({ name: 'X', offset: -1 }, ctx);
    expect(negOffset.isError).toBe(true);
    expect((negOffset.content[0] as any).text).toMatch(/offset/);
  });

  it('paging adds zero new cache misses past page 1', async () => {
    writeFiveMatches();
    clearAstCache();
    await findSymbol(tmp, 'Btn', 'any', 2, 0);
    const missesAfterPage1 = getAstCacheStats().misses;
    await findSymbol(tmp, 'Btn', 'any', 2, 2);
    expect(getAstCacheStats().misses).toBe(missesAfterPage1);
  });
});
