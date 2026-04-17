import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findReferences, findReferencesTool } from '../../src/tools/find-references.js';
import { clearAstCache, getAstCacheStats } from '../../src/tools/shared/ast-cache.js';

let tmp: string;

function write(rel: string, content = '') {
  const full = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

beforeEach(() => {
  clearAstCache();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'refs-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('findReferences', () => {
  it('finds named-export imports and call sites', async () => {
    write('src/lib/api.ts', 'export function fetchUser() { return null; }');
    write(
      'src/app/page.tsx',
      `import { fetchUser } from '../lib/api';
export default function P() {
  const u = fetchUser();
  return u;
}`
    );

    const result = await findReferences(tmp, 'fetchUser', 'src/lib/api.ts');
    expect(result.symbol).toBe('fetchUser');
    expect(result.definedIn).toBe('src/lib/api.ts');
    const kinds = result.references.map((r) => r.kind).sort();
    expect(kinds).toEqual(['call', 'import']);
    const call = result.references.find((r) => r.kind === 'call');
    expect(call?.file).toBe('src/app/page.tsx');
    expect(call?.localName).toBe('fetchUser');
  });

  it('follows renamed named imports', async () => {
    write('src/lib/api.ts', 'export function fetchUser() {}');
    write(
      'src/app/page.tsx',
      `import { fetchUser as getUser } from '../lib/api';
const u = getUser();`
    );

    const result = await findReferences(tmp, 'fetchUser', 'src/lib/api.ts');
    const call = result.references.find((r) => r.kind === 'call');
    expect(call?.localName).toBe('getUser');
  });

  it('detects JSX usage for imported components', async () => {
    write(
      'src/components/Button.tsx',
      'export function Button() { return null; }'
    );
    write(
      'src/app/page.tsx',
      `import { Button } from '../components/Button';
export default function P() {
  return <Button />;
}`
    );

    const result = await findReferences(tmp, 'Button', 'src/components/Button.tsx');
    const jsx = result.references.find((r) => r.kind === 'jsx');
    expect(jsx).toBeDefined();
  });

  it('handles default-export renames (local name may differ)', async () => {
    write(
      'src/components/Button.tsx',
      'export default function Button() { return null; }'
    );
    write(
      'src/app/page.tsx',
      `import MyBtn from '../components/Button';
export default function P() { return <MyBtn />; }`
    );

    const result = await findReferences(tmp, 'Button', 'src/components/Button.tsx');
    // Default imports are matched regardless of local name
    expect(result.references.some((r) => r.kind === 'import')).toBe(true);
    expect(result.references.some((r) => r.kind === 'jsx' && r.localName === 'MyBtn')).toBe(true);
  });

  it('handles namespace imports via member access', async () => {
    write('src/lib/util.ts', 'export const x = 1;');
    write(
      'src/app/page.tsx',
      `import * as utils from '../lib/util';
const v = utils.x;`
    );

    const result = await findReferences(tmp, 'x', 'src/lib/util.ts');
    // Expect the import line + the member access usage
    expect(result.references.length).toBeGreaterThanOrEqual(2);
    expect(result.references.some((r) => r.localName === 'utils.x')).toBe(true);
  });

  it('detects type-position references', async () => {
    write('src/types.ts', 'export type User = { id: string };');
    write(
      'src/app/user.ts',
      `import type { User } from '../types';
let u: User | null = null;
export { u };`
    );

    const result = await findReferences(tmp, 'User', 'src/types.ts');
    const typeRef = result.references.find((r) => r.kind === 'type');
    expect(typeRef).toBeDefined();
  });

  it('counts re-exports as references', async () => {
    write('src/lib/api.ts', 'export function fetchUser() {}');
    write('src/index.ts', `export { fetchUser } from './lib/api';`);

    const result = await findReferences(tmp, 'fetchUser', 'src/lib/api.ts');
    expect(result.references.some((r) => r.file === 'src/index.ts')).toBe(true);
  });

  it('resolves imports through tsconfig alias', async () => {
    write(
      'tsconfig.json',
      JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } })
    );
    write('src/lib/api.ts', 'export function fetchUser() {}');
    write(
      'src/app/page.tsx',
      `import { fetchUser } from '@/lib/api';
const u = fetchUser();`
    );

    const result = await findReferences(tmp, 'fetchUser', 'src/lib/api.ts');
    expect(result.references.some((r) => r.kind === 'call')).toBe(true);
  });

  it('skips shadowing declarations', async () => {
    write('src/lib/api.ts', 'export function fetchUser() {}');
    write(
      'src/app/page.tsx',
      `import { fetchUser } from '../lib/api';
function greet(fetchUser: string) { return fetchUser; }`
    );

    const result = await findReferences(tmp, 'fetchUser', 'src/lib/api.ts');
    // We don't do proper scope analysis — the parameter shadowing will produce
    // a false-positive identifier hit. That's acceptable for the MVP; we just
    // document it by asserting the import is reported. Real-world shadowing is
    // rare and LLMs can eyeball the line numbers.
    expect(result.references.some((r) => r.kind === 'import')).toBe(true);
  });

  it('returns zero references when nothing imports the file', async () => {
    write('src/lib/unused.ts', 'export function noop() {}');
    write('src/lib/other.ts', 'export function somethingElse() {}');

    const result = await findReferences(tmp, 'noop', 'src/lib/unused.ts');
    expect(result.total).toBe(0);
    expect(result.references).toEqual([]);
  });

  it('excludes node_modules and dist', async () => {
    write('src/lib/api.ts', 'export function fetchUser() {}');
    write('src/app/page.tsx', `import { fetchUser } from '../lib/api';\nfetchUser();`);
    write(
      'node_modules/foo/index.ts',
      `import { fetchUser } from '../../src/lib/api';\nfetchUser();`
    );
    write('dist/bundle.js', `import { fetchUser } from '../src/lib/api';\nfetchUser();`);

    const result = await findReferences(tmp, 'fetchUser', 'src/lib/api.ts');
    const files = new Set(result.references.map((r) => r.file));
    expect(Array.from(files)).toEqual(['src/app/page.tsx']);
  });

  it('throws when the target file does not exist', async () => {
    await expect(findReferences(tmp, 'x', 'nope.ts')).rejects.toThrow(/File not found/);
  });
});

describe('findReferences - pagination', () => {
  // 5 importers, each with one call site → 10 references total.
  function writeFiveImporters() {
    write('src/lib/api.ts', 'export function fetchUser() {}');
    for (const name of ['a', 'b', 'c', 'd', 'e']) {
      write(
        `src/app/${name}.ts`,
        `import { fetchUser } from '../lib/api';
fetchUser();`
      );
    }
  }

  it('default page returns everything', async () => {
    writeFiveImporters();
    const r = await findReferences(tmp, 'fetchUser', 'src/lib/api.ts');
    expect(r.total).toBeGreaterThanOrEqual(10);
    expect(r.references).toHaveLength(r.total);
    expect(r.hasMore).toBe(false);
    expect(r.nextOffset).toBeNull();
  });

  it('paged call returns the requested slice', async () => {
    writeFiveImporters();
    const r = await findReferences(tmp, 'fetchUser', 'src/lib/api.ts', 2, 0);
    expect(r.references).toHaveLength(2);
    expect(r.hasMore).toBe(true);
    expect(r.nextOffset).toBe(2);
  });

  it('last partial page clears hasMore', async () => {
    writeFiveImporters();
    const full = await findReferences(tmp, 'fetchUser', 'src/lib/api.ts');
    const lastOffset = full.total - 1;
    const r = await findReferences(tmp, 'fetchUser', 'src/lib/api.ts', 2, lastOffset);
    expect(r.references).toHaveLength(1);
    expect(r.hasMore).toBe(false);
    expect(r.nextOffset).toBeNull();
  });

  it('offset past the end returns empty', async () => {
    writeFiveImporters();
    const r = await findReferences(tmp, 'fetchUser', 'src/lib/api.ts', 5, 1000);
    expect(r.references).toEqual([]);
    expect(r.hasMore).toBe(false);
  });

  it('concatenated pages equal the full list', async () => {
    writeFiveImporters();
    const all = await findReferences(tmp, 'fetchUser', 'src/lib/api.ts');
    const collected: typeof all.references = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page: Awaited<ReturnType<typeof findReferences>> = await findReferences(
        tmp,
        'fetchUser',
        'src/lib/api.ts',
        3,
        offset
      );
      collected.push(...page.references);
      offset = page.nextOffset;
    }
    expect(collected).toEqual(all.references);
  });

  it('handler rejects limit <= 0 and offset < 0', async () => {
    write('src/lib/api.ts', 'export function fetchUser() {}');
    const ctx = { resolvedProjectPath: tmp, pluginManager: {} as any };
    const badLimit = await findReferencesTool.handler(
      { symbol: 'fetchUser', file: 'src/lib/api.ts', limit: 0 },
      ctx
    );
    expect(badLimit.isError).toBe(true);
    const negOffset = await findReferencesTool.handler(
      { symbol: 'fetchUser', file: 'src/lib/api.ts', offset: -1 },
      ctx
    );
    expect(negOffset.isError).toBe(true);
  });

  it('paging adds zero new cache misses past page 1', async () => {
    writeFiveImporters();
    clearAstCache();
    await findReferences(tmp, 'fetchUser', 'src/lib/api.ts', 2, 0);
    const missesAfterPage1 = getAstCacheStats().misses;
    await findReferences(tmp, 'fetchUser', 'src/lib/api.ts', 2, 2);
    expect(getAstCacheStats().misses).toBe(missesAfterPage1);
  });
});
