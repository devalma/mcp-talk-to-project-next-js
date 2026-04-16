import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  analyzeImports,
  extractImports,
  type ImportAnalysis,
  type OutgoingBlock,
  type IncomingImport,
} from '../../src/tools/analyze-imports.js';

let tmp: string;

function write(rel: string, content = '') {
  const full = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function outgoingOf(result: ImportAnalysis): OutgoingBlock {
  if (result.outgoing === null) throw new Error('expected outgoing to be computed');
  return result.outgoing;
}

function incomingOf(result: ImportAnalysis): IncomingImport[] {
  if (result.incoming === null) throw new Error('expected incoming to be computed');
  return result.incoming;
}

const byString = (a: string, b: string) => a.localeCompare(b);

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'imports-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('extractImports', () => {
  it('extracts default, named, and namespace imports', () => {
    write(
      'src/a.ts',
      `
import React from 'react';
import { useState, useEffect } from 'react';
import * as utils from './utils';
`
    );
    const imports = extractImports(path.join(tmp, 'src/a.ts'));
    const sources = imports.map((i) => i.source).sort(byString);
    expect(sources).toEqual(['./utils', 'react', 'react']);

    const reactDefault = imports.find(
      (i) => i.source === 'react' && i.specifiers.includes('default')
    );
    expect(reactDefault).toBeDefined();

    const namespaceImport = imports.find((i) => i.source === './utils');
    expect(namespaceImport?.specifiers).toEqual(['*']);
  });

  it('distinguishes type-only imports', () => {
    write(
      'src/a.ts',
      `
import type { User } from './types';
import { type Role, foo } from './mixed';
`
    );
    const imports = extractImports(path.join(tmp, 'src/a.ts'));
    const typeImport = imports.find((i) => i.source === './types');
    expect(typeImport?.kind).toBe('type');

    // Mixed: value + type specifier within same import → value
    const mixedImport = imports.find((i) => i.source === './mixed');
    expect(mixedImport?.kind).toBe('value');
  });

  it('captures re-exports from another module', () => {
    write(
      'src/barrel.ts',
      `
export { foo } from './foo';
export * from './bar';
`
    );
    const imports = extractImports(path.join(tmp, 'src/barrel.ts'));
    expect(imports.every((i) => i.kind === 're-export')).toBe(true);
    expect(imports.map((i) => i.source).sort(byString)).toEqual(['./bar', './foo']);
  });

  it('captures dynamic imports', () => {
    write(
      'src/a.ts',
      `
async function load() {
  const mod = await import('./heavy');
  return mod;
}
`
    );
    const imports = extractImports(path.join(tmp, 'src/a.ts'));
    const dyn = imports.find((i) => i.source === './heavy');
    expect(dyn?.kind).toBe('dynamic');
  });

  it('handles JSX / TSX files', () => {
    write(
      'src/Comp.tsx',
      `
import React from 'react';
export default function Comp() {
  return <div>{'hello'}</div>;
}
`
    );
    const imports = extractImports(path.join(tmp, 'src/Comp.tsx'));
    expect(imports[0].source).toBe('react');
  });

  it('returns [] for empty or unparseable files', () => {
    write('src/empty.ts', '');
    expect(extractImports(path.join(tmp, 'src/empty.ts'))).toEqual([]);

    write('src/broken.ts', 'const @@@ = {');
    expect(extractImports(path.join(tmp, 'src/broken.ts'))).toEqual([]);
  });

  it('records line numbers', () => {
    write(
      'src/a.ts',
      `
// line 1
import { x } from './x';
`
    );
    const imports = extractImports(path.join(tmp, 'src/a.ts'));
    expect(imports[0].line).toBe(3);
  });
});

describe('analyzeImports outgoing', () => {
  it('classifies local, external, and unresolved imports', async () => {
    write(
      'src/app/page.tsx',
      `
import React from 'react';
import { helper } from './helpers';
import { missing } from './does-not-exist';
`
    );
    write('src/app/helpers.ts', 'export const helper = 1;');

    const result = await analyzeImports(tmp, 'src/app/page.tsx', 'outgoing');
    const { local, external, unresolved } = outgoingOf(result);

    expect(external.map((i) => i.source)).toContain('react');
    expect(local.map((i) => i.resolvedFile)).toContain('src/app/helpers.ts');
    expect(unresolved.map((i) => i.source)).toContain('./does-not-exist');
  });

  it('resolves index files inside a directory', async () => {
    write('src/a.ts', `import { x } from './lib';`);
    write('src/lib/index.ts', 'export const x = 1;');

    const result = await analyzeImports(tmp, 'src/a.ts', 'outgoing');
    expect(outgoingOf(result).local[0].resolvedFile).toBe('src/lib/index.ts');
  });

  it('resolves TS-ESM imports with explicit .js extension to the actual .ts file', async () => {
    write('src/a.ts', `import { x } from './x.js';`);
    write('src/x.ts', 'export const x = 1;');

    const result = await analyzeImports(tmp, 'src/a.ts', 'outgoing');
    const { local } = outgoingOf(result);
    expect(local).toHaveLength(1);
    expect(local[0].resolvedFile).toBe('src/x.ts');
  });

  it('resolves .jsx→.tsx TS-ESM convention', async () => {
    write('src/a.ts', `import Comp from './Comp.jsx';`);
    write('src/Comp.tsx', 'export default function C() { return null; }');

    const result = await analyzeImports(tmp, 'src/a.ts', 'outgoing');
    expect(outgoingOf(result).local[0].resolvedFile).toBe('src/Comp.tsx');
  });

  it('resolves tsconfig paths aliases (@/*)', async () => {
    write(
      'tsconfig.json',
      JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } })
    );
    write('src/a.ts', `import { foo } from '@/utils/foo';`);
    write('src/utils/foo.ts', 'export const foo = 1;');

    const result = await analyzeImports(tmp, 'src/a.ts', 'outgoing');
    expect(outgoingOf(result).local[0].resolvedFile).toBe('src/utils/foo.ts');
  });

  it('strips comments from tsconfig.json before parsing', async () => {
    write(
      'tsconfig.json',
      `{
  // leading comment
  "compilerOptions": {
    /* block */
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}`
    );
    write('src/a.ts', `import { foo } from '@/foo';`);
    write('src/foo.ts', 'export const foo = 1;');

    const result = await analyzeImports(tmp, 'src/a.ts', 'outgoing');
    expect(outgoingOf(result).local[0].resolvedFile).toBe('src/foo.ts');
  });

  it('throws when the target file does not exist', async () => {
    await expect(analyzeImports(tmp, 'nope.ts', 'outgoing')).rejects.toThrow(
      /File not found/
    );
  });

  it('returns null for incoming when direction is outgoing', async () => {
    write('src/a.ts', `import React from 'react';`);
    const result = await analyzeImports(tmp, 'src/a.ts', 'outgoing');
    expect(result.incoming).toBeNull();
    expect(result.outgoing).not.toBeNull();
  });
});

describe('analyzeImports incoming', () => {
  it('finds files that import the target (relative paths)', async () => {
    write('src/lib/api.ts', 'export const fetchUser = async () => ({});');
    write(
      'src/app/page.tsx',
      `import { fetchUser } from '../lib/api';\nexport default function P() {}`
    );
    write(
      'src/app/other.tsx',
      `import { fetchUser } from '../lib/api';\nexport default function O() {}`
    );
    write('src/unrelated.ts', `import React from 'react';`);

    const result = await analyzeImports(tmp, 'src/lib/api.ts', 'incoming');
    const files = incomingOf(result)
      .map((i) => i.file)
      .sort(byString);
    expect(files).toEqual(['src/app/other.tsx', 'src/app/page.tsx']);
  });

  it('finds importers via tsconfig alias', async () => {
    write(
      'tsconfig.json',
      JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } })
    );
    write('src/lib/util.ts', 'export const util = 1;');
    write(
      'src/app/page.tsx',
      `import { util } from '@/lib/util';\nexport default function P() {}`
    );

    const result = await analyzeImports(tmp, 'src/lib/util.ts', 'incoming');
    expect(incomingOf(result).map((i) => i.file)).toContain('src/app/page.tsx');
  });

  it('excludes node_modules and dist', async () => {
    write('src/lib/api.ts', 'export const x = 1;');
    write('src/app/page.tsx', `import { x } from '../lib/api';`);
    write('node_modules/foo/index.ts', `import { x } from '../../src/lib/api';`);
    write('dist/bundle.js', `import { x } from '../src/lib/api';`);

    const result = await analyzeImports(tmp, 'src/lib/api.ts', 'incoming');
    expect(incomingOf(result).map((i) => i.file)).toEqual(['src/app/page.tsx']);
  });

  it('returns dynamic-import importers with kind="dynamic"', async () => {
    write('src/lib/heavy.ts', 'export const x = 1;');
    write(
      'src/app/page.tsx',
      `async function load() { return import('../lib/heavy'); }`
    );

    const result = await analyzeImports(tmp, 'src/lib/heavy.ts', 'incoming');
    expect(incomingOf(result)[0].kind).toBe('dynamic');
  });

  it('returns null for outgoing when direction is incoming', async () => {
    write('src/a.ts', `import React from 'react';`);
    const result = await analyzeImports(tmp, 'src/a.ts', 'incoming');
    expect(result.outgoing).toBeNull();
    expect(result.incoming).not.toBeNull();
  });
});

describe('analyzeImports both directions', () => {
  it('returns both outgoing and incoming when direction=both', async () => {
    write('src/a.ts', `import React from 'react';\nexport const a = 1;`);
    write('src/b.ts', `import { a } from './a';\nexport const b = 2;`);

    const result = await analyzeImports(tmp, 'src/a.ts', 'both');
    expect(outgoingOf(result).external[0].source).toBe('react');
    expect(incomingOf(result)[0].file).toBe('src/b.ts');
  });
});
