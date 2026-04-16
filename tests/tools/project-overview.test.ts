import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  computeOverview,
  summarizeRoutes,
} from '../../src/tools/project-overview.js';
import type { Route } from '../../src/tools/analyze-routes.js';

let tmp: string;

function write(rel: string, content: string | object = '') {
  const full = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(
    full,
    typeof content === 'string' ? content : JSON.stringify(content, null, 2)
  );
}

const nullPluginManager = {
  executePlugin: async () => ({ success: false, data: null }),
};

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'overview-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('summarizeRoutes', () => {
  const mk = (p: string, over: Partial<Route>): Route => ({
    path: p,
    file: `app${p}/page.tsx`,
    routerType: 'app',
    kind: 'page',
    dynamicSegments: [],
    rendering: 'server',
    dataFetching: 'none',
    ...over,
  });

  it('counts kinds, dynamic, and rendering', () => {
    const routes: Route[] = [
      mk('/', {}),
      mk('/about', { rendering: 'client', dataFetching: 'none' }),
      mk('/blog/[slug]', { dynamicSegments: ['slug'], dataFetching: 'async-rsc' }),
      mk('/api/users', {
        kind: 'route-handler',
        rendering: null,
        dataFetching: 'route-handler',
      }),
      mk('/api/legacy', {
        routerType: 'pages',
        kind: 'api-route',
        rendering: null,
        dataFetching: 'route-handler',
      }),
    ];
    const s = summarizeRoutes(routes);
    expect(s.total).toBe(5);
    expect(s.pages).toBe(3);
    expect(s.routeHandlers).toBe(1);
    expect(s.apiRoutes).toBe(1);
    expect(s.dynamic).toBe(1);
    expect(s.server).toBe(2);
    expect(s.client).toBe(1);
  });

  it('returns zeroes for empty list', () => {
    const s = summarizeRoutes([]);
    expect(s).toEqual({
      total: 0,
      pages: 0,
      routeHandlers: 0,
      apiRoutes: 0,
      dynamic: 0,
      server: 0,
      client: 0,
    });
  });
});

describe('computeOverview', () => {
  it('combines fingerprint, routes, and counts', async () => {
    write('package.json', {
      name: 'my-app',
      version: '1.2.3',
      dependencies: { next: '14.2.0', react: '18.2.0', tailwindcss: '3.4.0' },
    });
    write('tsconfig.json', '{}');
    write('src/app/page.tsx', 'export default function H() {}');
    write('src/app/about/page.tsx', `'use client';\nexport default function A() {}`);

    const overview = await computeOverview(tmp, nullPluginManager);

    expect(overview.name).toBe('my-app');
    expect(overview.version).toBe('1.2.3');
    expect(overview.fingerprint.framework.nextVersion).toBe('14.2.0');
    expect(overview.fingerprint.framework.router).toBe('app');
    expect(overview.fingerprint.stack.styling).toContain('tailwind');
    expect(overview.routes.total).toBe(2);
    expect(overview.routes.pages).toBe(2);
    expect(overview.routes.server).toBe(1);
    expect(overview.routes.client).toBe(1);
    expect(overview.counts).toEqual({ components: 0, customHooks: 0 });
  });

  it('pulls counts from plugin manager when available', async () => {
    write('package.json', { name: 'x', dependencies: { next: '14.0.0' } });

    const fakeManager = {
      executePlugin: async (name: string) => {
        if (name === 'component-extractor') {
          return { success: true, data: { totalComponents: 42 } };
        }
        if (name === 'hook-extractor') {
          return { success: true, data: { totalCustomHooks: 7 } };
        }
        return { success: false, data: null };
      },
    };

    const overview = await computeOverview(tmp, fakeManager);
    expect(overview.counts).toEqual({ components: 42, customHooks: 7 });
  });

  it('tolerates a failing plugin manager', async () => {
    write('package.json', { name: 'x', dependencies: { next: '14.0.0' } });

    const brokenManager = {
      executePlugin: async () => {
        throw new Error('boom');
      },
    };

    const overview = await computeOverview(tmp, brokenManager);
    expect(overview.counts).toEqual({ components: 0, customHooks: 0 });
    // fingerprint and routes still work
    expect(overview.fingerprint.framework.nextVersion).toBe('14.0.0');
  });

  it('falls back to directory name when package.json is missing', async () => {
    const overview = await computeOverview(tmp, nullPluginManager);
    expect(overview.name).toBe(path.basename(tmp));
    expect(overview.version).toBeNull();
  });
});
