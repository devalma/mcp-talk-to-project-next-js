import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  analyzeRoutes,
  matchesPathFilter,
} from '../../src/tools/analyze-routes.js';

let tmp: string;

function write(rel: string, content = '') {
  const full = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'routes-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('App Router discovery', () => {
  it('maps page.tsx files to their URLs', async () => {
    write('src/app/page.tsx', 'export default function Home() {}');
    write('src/app/about/page.tsx', 'export default function About() {}');
    write('src/app/blog/[slug]/page.tsx', 'export default function Post() {}');

    const routes = await analyzeRoutes(tmp);
    const paths = routes.map((r) => r.path).sort();
    expect(paths).toEqual(['/', '/about', '/blog/[slug]']);
    expect(routes.every((r) => r.routerType === 'app')).toBe(true);
    expect(routes.every((r) => r.kind === 'page')).toBe(true);
  });

  it('strips route groups and parallel slots from the URL', async () => {
    write('src/app/(marketing)/about/page.tsx', 'export default function A() {}');
    write('src/app/@modal/login/page.tsx', 'export default function L() {}');

    const routes = await analyzeRoutes(tmp);
    const paths = routes.map((r) => r.path).sort();
    expect(paths).toEqual(['/about', '/login']);
  });

  it('skips intercepting routes', async () => {
    write('src/app/feed/page.tsx', 'export default function F() {}');
    write('src/app/feed/(.)photo/[id]/page.tsx', 'export default function P() {}');

    const routes = await analyzeRoutes(tmp);
    expect(routes.map((r) => r.path)).toEqual(['/feed']);
  });

  it('detects use client directive and marks rendering', async () => {
    write(
      'src/app/dashboard/page.tsx',
      `'use client';\nexport default function D() {}`
    );
    write('src/app/server-only/page.tsx', 'export default function S() {}');

    const routes = await analyzeRoutes(tmp);
    const byPath = Object.fromEntries(routes.map((r) => [r.path, r]));
    expect(byPath['/dashboard'].rendering).toBe('client');
    expect(byPath['/dashboard'].dataFetching).toBe('none');
    expect(byPath['/server-only'].rendering).toBe('server');
  });

  it('detects async RSC with default export', async () => {
    write(
      'src/app/posts/page.tsx',
      `export default async function Posts() { const data = await fetch('...'); return null; }`
    );

    const routes = await analyzeRoutes(tmp);
    expect(routes[0].rendering).toBe('server');
    expect(routes[0].dataFetching).toBe('async-rsc');
  });

  it('tolerates leading comments before use client', async () => {
    write(
      'src/app/c/page.tsx',
      `// header comment\n/* block */\n'use client';\nexport default function C() {}`
    );
    const routes = await analyzeRoutes(tmp);
    expect(routes[0].rendering).toBe('client');
  });

  it('builds the layout chain from outermost to innermost', async () => {
    write('src/app/layout.tsx', 'export default function Root() {}');
    write('src/app/settings/layout.tsx', 'export default function SLayout() {}');
    write('src/app/settings/profile/page.tsx', 'export default function P() {}');

    const routes = await analyzeRoutes(tmp);
    expect(routes[0].path).toBe('/settings/profile');
    expect(routes[0].layoutChain).toEqual([
      'src/app/layout.tsx',
      'src/app/settings/layout.tsx',
    ]);
  });

  it('detects route handlers with HTTP methods', async () => {
    write(
      'src/app/api/users/route.ts',
      `export async function GET() {}\nexport async function POST() {}`
    );
    write('src/app/api/ping/route.ts', `export const HEAD = () => {}`);

    const routes = await analyzeRoutes(tmp);
    const byPath = Object.fromEntries(routes.map((r) => [r.path, r]));
    expect(byPath['/api/users'].kind).toBe('route-handler');
    expect(byPath['/api/users'].methods).toEqual(['GET', 'POST']);
    expect(byPath['/api/users'].dataFetching).toBe('route-handler');
    expect(byPath['/api/ping'].methods).toEqual(['HEAD']);
  });

  it('extracts dynamic segments from path', async () => {
    write('src/app/blog/[slug]/page.tsx', 'export default function P() {}');
    write('src/app/docs/[...slug]/page.tsx', 'export default function D() {}');
    write('src/app/shop/[[...filters]]/page.tsx', 'export default function S() {}');

    const routes = await analyzeRoutes(tmp);
    const byPath = Object.fromEntries(routes.map((r) => [r.path, r]));
    expect(byPath['/blog/[slug]'].dynamicSegments).toEqual(['slug']);
    expect(byPath['/docs/[...slug]'].dynamicSegments).toEqual(['...slug']);
    expect(byPath['/shop/[[...filters]]'].dynamicSegments).toContain('[...filters]');
  });
});

describe('Pages Router discovery', () => {
  it('maps file paths to URLs with index→directory rule', async () => {
    write('pages/index.tsx', 'export default function H() {}');
    write('pages/about.tsx', 'export default function A() {}');
    write('pages/blog/index.tsx', 'export default function B() {}');
    write('pages/blog/[id].tsx', 'export default function P() {}');

    const routes = await analyzeRoutes(tmp);
    const paths = routes.map((r) => r.path).sort();
    expect(paths).toEqual(['/', '/about', '/blog', '/blog/[id]']);
    expect(routes.every((r) => r.routerType === 'pages')).toBe(true);
  });

  it('tags /api/* as api-route', async () => {
    write('pages/api/users.ts', `export default function H() {}`);
    write('pages/api/users/[id].ts', `export default function H() {}`);

    const routes = await analyzeRoutes(tmp);
    expect(routes.every((r) => r.kind === 'api-route')).toBe(true);
    expect(routes.every((r) => r.dataFetching === 'route-handler')).toBe(true);
  });

  it('detects getServerSideProps and getStaticProps', async () => {
    write(
      'pages/profile.tsx',
      `export async function getServerSideProps() { return { props: {} }; }\nexport default function P() {}`
    );
    write(
      'pages/blog.tsx',
      `export async function getStaticProps() { return { props: {} }; }\nexport default function B() {}`
    );
    write('pages/static.tsx', 'export default function S() {}');

    const routes = await analyzeRoutes(tmp);
    const byPath = Object.fromEntries(routes.map((r) => [r.path, r]));
    expect(byPath['/profile'].dataFetching).toBe('gssp');
    expect(byPath['/blog'].dataFetching).toBe('gsp');
    expect(byPath['/static'].dataFetching).toBe('none');
  });

  it('excludes _app, _document, _error internals', async () => {
    write('pages/_app.tsx', 'export default function A() {}');
    write('pages/_document.tsx', 'export default function D() {}');
    write('pages/_error.tsx', 'export default function E() {}');
    write('pages/index.tsx', 'export default function H() {}');

    const routes = await analyzeRoutes(tmp);
    expect(routes.map((r) => r.path)).toEqual(['/']);
  });
});

describe('Mixed routers', () => {
  it('returns routes from both app and pages', async () => {
    write('app/home/page.tsx', 'export default function H() {}');
    write('pages/about.tsx', 'export default function A() {}');

    const routes = await analyzeRoutes(tmp);
    const byRouter = { app: 0, pages: 0 };
    for (const r of routes) byRouter[r.routerType]++;
    expect(byRouter.app).toBe(1);
    expect(byRouter.pages).toBe(1);
  });
});

describe('matchesPathFilter', () => {
  const route = (p: string) =>
    ({ path: p }) as Parameters<ReturnType<typeof matchesPathFilter>>[0];

  it('supports exact match', () => {
    const f = matchesPathFilter('/settings');
    expect(f(route('/settings'))).toBe(true);
    expect(f(route('/settings/profile'))).toBe(false);
  });

  it('supports /prefix/** glob', () => {
    const f = matchesPathFilter('/settings/**');
    expect(f(route('/settings'))).toBe(true);
    expect(f(route('/settings/profile'))).toBe(true);
    expect(f(route('/settings/billing/plans'))).toBe(true);
    expect(f(route('/other'))).toBe(false);
  });

  it('supports /** matching everything', () => {
    const f = matchesPathFilter('/**');
    expect(f(route('/'))).toBe(true);
    expect(f(route('/anything/here'))).toBe(true);
  });
});
