import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { computeFingerprint } from '../../src/tools/project-fingerprint.js';

let tmp: string;

function write(rel: string, content: string | object) {
  const full = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(
    full,
    typeof content === 'string' ? content : JSON.stringify(content, null, 2)
  );
}

function mkdir(rel: string) {
  fs.mkdirSync(path.join(tmp, rel), { recursive: true });
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fingerprint-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('computeFingerprint', () => {
  it('returns null router and no stack for an empty directory', () => {
    const fp = computeFingerprint(tmp);
    expect(fp.framework.router).toBeNull();
    expect(fp.framework.nextVersion).toBeNull();
    expect(fp.framework.typescript).toBe(false);
    expect(fp.tooling.packageManager).toBeNull();
    expect(fp.stack.styling).toEqual([]);
    expect(fp.stack.stateManagement).toEqual([]);
    expect(fp.configFiles).toEqual([]);
  });

  it('detects App Router project with src/app layout', () => {
    write('package.json', {
      name: 'test-app',
      dependencies: { next: '^14.2.3', react: '18.2.0', 'react-dom': '18.2.0' },
    });
    mkdir('src/app');
    write('tsconfig.json', '{}');
    write('pnpm-lock.yaml', '');
    write('next.config.mjs', 'export default {};');

    const fp = computeFingerprint(tmp);
    expect(fp.framework.router).toBe('app');
    expect(fp.framework.nextVersion).toBe('14.2.3');
    expect(fp.framework.reactVersion).toBe('18.2.0');
    expect(fp.framework.typescript).toBe(true);
    expect(fp.structure.appDir).toBe('src/app');
    expect(fp.structure.srcDir).toBe('src');
    expect(fp.tooling.packageManager).toBe('pnpm');
    expect(fp.configFiles).toContain('next.config.mjs');
    expect(fp.configFiles).toContain('tsconfig.json');
  });

  it('detects Pages Router project', () => {
    write('package.json', { dependencies: { next: '13.5.6', react: '18.2.0' } });
    mkdir('pages');
    write('yarn.lock', '');

    const fp = computeFingerprint(tmp);
    expect(fp.framework.router).toBe('pages');
    expect(fp.structure.pagesDir).toBe('pages');
    expect(fp.structure.appDir).toBeNull();
    expect(fp.tooling.packageManager).toBe('yarn');
  });

  it('detects mixed router (both app and pages)', () => {
    write('package.json', { dependencies: { next: '14.0.0' } });
    mkdir('app');
    mkdir('pages');

    expect(computeFingerprint(tmp).framework.router).toBe('mixed');
  });

  it('detects stack from dependencies', () => {
    write('package.json', {
      dependencies: {
        next: '14.2.0',
        react: '18.2.0',
        tailwindcss: '3.4.0',
        zustand: '4.5.0',
        '@tanstack/react-query': '5.0.0',
        'react-hook-form': '7.50.0',
        zod: '3.22.0',
        'next-intl': '3.0.0',
        '@clerk/nextjs': '4.30.0',
        '@prisma/client': '5.10.0',
        prisma: '5.10.0',
      },
      devDependencies: {
        vitest: '1.0.0',
        eslint: '8.0.0',
        prettier: '3.0.0',
        typescript: '5.3.0',
      },
    });
    mkdir('components/ui'); // shadcn signal

    const fp = computeFingerprint(tmp);
    expect(fp.stack.styling).toContain('tailwind');
    expect(fp.stack.stateManagement).toContain('zustand');
    expect(fp.stack.dataFetching).toContain('react-query');
    expect(fp.stack.forms).toContain('react-hook-form');
    expect(fp.stack.validation).toContain('zod');
    expect(fp.stack.i18n).toBe('next-intl');
    expect(fp.stack.auth).toBe('clerk');
    expect(fp.stack.dataLayer).toBe('prisma');
    expect(fp.stack.uiKit).toBe('shadcn');
    expect(fp.tooling.testFramework).toBe('vitest');
    expect(fp.tooling.linter).toBe('eslint');
    expect(fp.tooling.formatter).toBe('prettier');
    expect(fp.versions.next).toBe('14.2.0');
    expect(fp.versions.zod).toBe('3.22.0');
  });

  it('detects middleware at root and in src/', () => {
    write('package.json', { dependencies: { next: '14.0.0' } });
    write('middleware.ts', '');
    const fp1 = computeFingerprint(tmp);
    expect(fp1.structure.hasMiddleware).toBe(true);

    fs.rmSync(path.join(tmp, 'middleware.ts'));
    write('src/middleware.ts', '');
    const fp2 = computeFingerprint(tmp);
    expect(fp2.structure.hasMiddleware).toBe(true);
  });

  it('detects Biome as both linter and formatter', () => {
    write('package.json', {
      dependencies: { next: '14.0.0' },
      devDependencies: { '@biomejs/biome': '1.5.0' },
    });
    write('biome.json', '{}');

    const fp = computeFingerprint(tmp);
    expect(fp.tooling.linter).toBe('biome');
    expect(fp.tooling.formatter).toBe('biome');
  });

  it('detects bun package manager', () => {
    write('package.json', { dependencies: { next: '14.0.0' } });
    write('bun.lockb', '');
    expect(computeFingerprint(tmp).tooling.packageManager).toBe('bun');
  });

  it('detects radix uiKit only when no shadcn convention present', () => {
    write('package.json', {
      dependencies: { next: '14.0.0', '@radix-ui/react-dialog': '1.0.0' },
    });
    expect(computeFingerprint(tmp).stack.uiKit).toBe('radix');
  });

  it('prefers shadcn over radix when components/ui exists', () => {
    write('package.json', {
      dependencies: { next: '14.0.0', '@radix-ui/react-dialog': '1.0.0' },
    });
    mkdir('src/components/ui');
    expect(computeFingerprint(tmp).stack.uiKit).toBe('shadcn');
  });

  it('handles malformed package.json without crashing', () => {
    fs.writeFileSync(path.join(tmp, 'package.json'), '{ not valid json');
    const fp = computeFingerprint(tmp);
    expect(fp.framework.nextVersion).toBeNull();
    expect(fp.stack.styling).toEqual([]);
  });
});
