/**
 * Project Fingerprint Tool
 *
 * Fast, no-AST project identification: framework, structure, tooling, stack.
 * Intended as the "session opener" — an LLM calls this first to ground itself
 * in the project before asking more expensive questions.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import type { ToolDefinition, ToolContext } from './types.js';
import { createTextResponse, createErrorResponse } from './types.js';

const ArgsSchema = z.object({
  format: z.enum(['text', 'markdown', 'json']).default('json').optional(),
});

type Args = z.infer<typeof ArgsSchema>;

export interface ProjectFingerprint {
  framework: {
    nextVersion: string | null;
    reactVersion: string | null;
    router: 'app' | 'pages' | 'mixed' | null;
    typescript: boolean;
  };
  structure: {
    srcDir: string | null;
    appDir: string | null;
    pagesDir: string | null;
    componentsDir: string | null;
    libDir: string | null;
    publicDir: string | null;
    hasMiddleware: boolean;
  };
  tooling: {
    packageManager: 'pnpm' | 'yarn' | 'npm' | 'bun' | null;
    testFramework: string | null;
    linter: string | null;
    formatter: string | null;
  };
  stack: {
    styling: string[];
    stateManagement: string[];
    dataFetching: string[];
    forms: string[];
    validation: string[];
    i18n: string | null;
    auth: string | null;
    dataLayer: string | null;
    uiKit: string | null;
  };
  configFiles: string[];
  versions: Record<string, string>;
}

export const projectFingerprintTool: ToolDefinition = {
  definition: {
    name: 'get_project_fingerprint',
    description:
      'Fast project identification: Next.js version, router (app/pages), directory layout, package manager, and detected stack (styling, state, forms, i18n, auth, ORM, etc.). Cheap call — no AST analysis. Use this first to ground yourself before asking more expensive questions.',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['text', 'markdown', 'json'],
          description: 'Output format',
          default: 'json',
        },
      },
    },
  } as Tool,

  handler: async (args: Args, context: ToolContext) => {
    try {
      const { format = 'json' } = ArgsSchema.parse(args);
      const fingerprint = computeFingerprint(context.resolvedProjectPath);

      if (format === 'json') {
        return createTextResponse(JSON.stringify(fingerprint, null, 2));
      }
      return createTextResponse(formatFingerprint(fingerprint, format));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(
          `Invalid arguments: ${error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
        );
      }
      const message = error instanceof Error ? error.message : String(error);
      return createErrorResponse(`Fingerprint failed: ${message}`);
    }
  },
};

/**
 * Compute the fingerprint from filesystem + package.json. Pure function (no MCP
 * coupling) so it can be unit-tested against fixture directories.
 */
export function computeFingerprint(projectPath: string): ProjectFingerprint {
  const pkg = readPackageJson(projectPath);
  const deps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };

  const srcDir = dirIfExists(projectPath, 'src');
  const appDir = firstExistingDir(projectPath, ['app', 'src/app']);
  const pagesDir = firstExistingDir(projectPath, ['pages', 'src/pages']);
  const componentsDir = firstExistingDir(projectPath, ['components', 'src/components']);
  const libDir = firstExistingDir(projectPath, ['lib', 'src/lib']);
  const publicDir = dirIfExists(projectPath, 'public');

  let router: 'app' | 'pages' | 'mixed' | null = null;
  if (appDir && pagesDir) router = 'mixed';
  else if (appDir) router = 'app';
  else if (pagesDir) router = 'pages';

  const tsconfigExists = fileExists(projectPath, 'tsconfig.json');
  const typescript = tsconfigExists || !!deps.typescript;

  const hasMiddleware =
    fileExists(projectPath, 'middleware.ts') ||
    fileExists(projectPath, 'middleware.js') ||
    fileExists(projectPath, 'src/middleware.ts') ||
    fileExists(projectPath, 'src/middleware.js');

  return {
    framework: {
      nextVersion: cleanVersion(deps.next),
      reactVersion: cleanVersion(deps.react),
      router,
      typescript,
    },
    structure: {
      srcDir,
      appDir,
      pagesDir,
      componentsDir,
      libDir,
      publicDir,
      hasMiddleware,
    },
    tooling: {
      packageManager: detectPackageManager(projectPath),
      testFramework: detectTestFramework(deps),
      linter: detectLinter(projectPath, deps),
      formatter: detectFormatter(projectPath, deps),
    },
    stack: detectStack(projectPath, deps),
    configFiles: detectConfigFiles(projectPath),
    versions: pickVersions(deps),
  };
}

// ---------- helpers ----------

function readPackageJson(projectPath: string): any {
  const p = path.join(projectPath, 'package.json');
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return {};
  }
}

function fileExists(projectPath: string, rel: string): boolean {
  return fs.existsSync(path.join(projectPath, rel));
}

function dirIfExists(projectPath: string, rel: string): string | null {
  const full = path.join(projectPath, rel);
  return fs.existsSync(full) && fs.statSync(full).isDirectory() ? rel : null;
}

function firstExistingDir(projectPath: string, candidates: string[]): string | null {
  for (const c of candidates) {
    const d = dirIfExists(projectPath, c);
    if (d) return d;
  }
  return null;
}

function cleanVersion(v: string | undefined): string | null {
  if (!v) return null;
  return v.replace(/^[\^~><=\s]+/, '').trim() || null;
}

function detectPackageManager(
  projectPath: string
): 'pnpm' | 'yarn' | 'npm' | 'bun' | null {
  if (fileExists(projectPath, 'pnpm-lock.yaml')) return 'pnpm';
  if (fileExists(projectPath, 'yarn.lock')) return 'yarn';
  if (fileExists(projectPath, 'bun.lockb') || fileExists(projectPath, 'bun.lock')) return 'bun';
  if (fileExists(projectPath, 'package-lock.json')) return 'npm';
  return null;
}

function detectTestFramework(deps: Record<string, string>): string | null {
  if (deps.vitest) return 'vitest';
  if (deps.jest || deps['ts-jest']) return 'jest';
  if (deps['@playwright/test']) return 'playwright';
  if (deps.mocha) return 'mocha';
  if (deps.cypress) return 'cypress';
  return null;
}

function detectLinter(projectPath: string, deps: Record<string, string>): string | null {
  if (deps['@biomejs/biome'] || fileExists(projectPath, 'biome.json')) return 'biome';
  if (
    deps.eslint ||
    fileExists(projectPath, '.eslintrc.json') ||
    fileExists(projectPath, '.eslintrc.js') ||
    fileExists(projectPath, '.eslintrc.cjs') ||
    fileExists(projectPath, 'eslint.config.js') ||
    fileExists(projectPath, 'eslint.config.mjs') ||
    fileExists(projectPath, 'eslint.config.ts')
  ) {
    return 'eslint';
  }
  return null;
}

function detectFormatter(
  projectPath: string,
  deps: Record<string, string>
): string | null {
  if (deps['@biomejs/biome'] || fileExists(projectPath, 'biome.json')) return 'biome';
  if (
    deps.prettier ||
    fileExists(projectPath, '.prettierrc') ||
    fileExists(projectPath, '.prettierrc.json') ||
    fileExists(projectPath, '.prettierrc.js') ||
    fileExists(projectPath, 'prettier.config.js')
  ) {
    return 'prettier';
  }
  return null;
}

function detectStack(
  projectPath: string,
  deps: Record<string, string>
): ProjectFingerprint['stack'] {
  const styling: string[] = [];
  if (deps.tailwindcss) styling.push('tailwind');
  if (deps['@emotion/react'] || deps['@emotion/styled']) styling.push('emotion');
  if (deps['styled-components']) styling.push('styled-components');
  if (deps.sass || deps['sass-embedded']) styling.push('sass');
  if (deps['@vanilla-extract/css']) styling.push('vanilla-extract');

  const stateManagement: string[] = [];
  if (deps.zustand) stateManagement.push('zustand');
  if (deps['@reduxjs/toolkit'] || deps.redux) stateManagement.push('redux');
  if (deps.jotai) stateManagement.push('jotai');
  if (deps.recoil) stateManagement.push('recoil');
  if (deps.valtio) stateManagement.push('valtio');
  if (deps.mobx || deps['mobx-react-lite']) stateManagement.push('mobx');

  const dataFetching: string[] = [];
  if (deps['@tanstack/react-query']) dataFetching.push('react-query');
  if (deps.swr) dataFetching.push('swr');
  if (deps['@trpc/client'] || deps['@trpc/server']) dataFetching.push('trpc');
  if (deps['@apollo/client']) dataFetching.push('apollo');
  if (deps.urql) dataFetching.push('urql');

  const forms: string[] = [];
  if (deps['react-hook-form']) forms.push('react-hook-form');
  if (deps.formik) forms.push('formik');
  if (deps['@tanstack/react-form']) forms.push('tanstack-form');

  const validation: string[] = [];
  if (deps.zod) validation.push('zod');
  if (deps.yup) validation.push('yup');
  if (deps.valibot) validation.push('valibot');
  if (deps.joi) validation.push('joi');

  let i18n: string | null = null;
  if (deps['next-intl']) i18n = 'next-intl';
  else if (deps['next-i18next']) i18n = 'next-i18next';
  else if (deps['react-i18next'] || deps.i18next) i18n = 'react-i18next';

  let auth: string | null = null;
  if (deps['next-auth'] || deps['@auth/core']) auth = 'next-auth';
  else if (deps['@clerk/nextjs']) auth = 'clerk';
  else if (deps['@supabase/ssr'] || deps['@supabase/auth-helpers-nextjs']) auth = 'supabase';
  else if (deps['@workos-inc/authkit-nextjs']) auth = 'workos';
  else if (deps['@kinde-oss/kinde-auth-nextjs']) auth = 'kinde';

  let dataLayer: string | null = null;
  if (deps['@prisma/client'] || deps.prisma) dataLayer = 'prisma';
  else if (deps['drizzle-orm']) dataLayer = 'drizzle';
  else if (deps['@supabase/supabase-js']) dataLayer = 'supabase';
  else if (deps.mongoose) dataLayer = 'mongoose';
  else if (deps.typeorm) dataLayer = 'typeorm';
  else if (deps.kysely) dataLayer = 'kysely';

  let uiKit: string | null = null;
  // shadcn isn't a package — detect by conventional components/ui directory
  if (
    fileExists(projectPath, 'components/ui') ||
    fileExists(projectPath, 'src/components/ui')
  ) {
    uiKit = 'shadcn';
  } else if (deps['@mui/material']) uiKit = 'mui';
  else if (deps['@chakra-ui/react']) uiKit = 'chakra';
  else if (deps.antd) uiKit = 'antd';
  else if (deps['@mantine/core']) uiKit = 'mantine';
  else if (Object.keys(deps).some((k) => k.startsWith('@radix-ui/'))) uiKit = 'radix';

  return { styling, stateManagement, dataFetching, forms, validation, i18n, auth, dataLayer, uiKit };
}

function detectConfigFiles(projectPath: string): string[] {
  const candidates = [
    'next.config.js',
    'next.config.mjs',
    'next.config.ts',
    'next.config.cjs',
    'tsconfig.json',
    'jsconfig.json',
    'tailwind.config.js',
    'tailwind.config.ts',
    'tailwind.config.mjs',
    'postcss.config.js',
    'postcss.config.mjs',
    'eslint.config.js',
    'eslint.config.mjs',
    '.eslintrc.json',
    '.eslintrc.js',
    '.eslintrc.cjs',
    'biome.json',
    '.prettierrc',
    '.prettierrc.json',
    'prettier.config.js',
    'middleware.ts',
    'middleware.js',
    'src/middleware.ts',
    'src/middleware.js',
    '.env',
    '.env.local',
    '.env.example',
    'prisma/schema.prisma',
    'drizzle.config.ts',
    'drizzle.config.js',
  ];
  return candidates.filter((c) => fileExists(projectPath, c));
}

function pickVersions(deps: Record<string, string>): Record<string, string> {
  const keys = [
    'next',
    'react',
    'react-dom',
    'typescript',
    'tailwindcss',
    'zod',
    '@tanstack/react-query',
    'react-hook-form',
    'next-intl',
    'next-auth',
    '@prisma/client',
    'drizzle-orm',
    'zustand',
  ];
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = cleanVersion(deps[k]);
    if (v) out[k] = v;
  }
  return out;
}

// ---------- formatting ----------

function formatFingerprint(fp: ProjectFingerprint, format: 'text' | 'markdown'): string {
  const lines: string[] = [];
  const h = format === 'markdown' ? '##' : '';
  const push = (section: string) => lines.push(format === 'markdown' ? `${h} ${section}` : `${section}:`);

  push('Framework');
  lines.push(`  Next.js: ${fp.framework.nextVersion ?? 'not detected'}`);
  lines.push(`  React: ${fp.framework.reactVersion ?? 'not detected'}`);
  lines.push(`  Router: ${fp.framework.router ?? 'unknown'}`);
  lines.push(`  TypeScript: ${fp.framework.typescript ? 'yes' : 'no'}`);
  lines.push('');

  push('Structure');
  for (const [k, v] of Object.entries(fp.structure)) {
    lines.push(`  ${k}: ${v === null ? '—' : v === true ? 'yes' : v === false ? 'no' : v}`);
  }
  lines.push('');

  push('Tooling');
  for (const [k, v] of Object.entries(fp.tooling)) {
    lines.push(`  ${k}: ${v ?? '—'}`);
  }
  lines.push('');

  push('Stack');
  for (const [k, v] of Object.entries(fp.stack)) {
    const val = Array.isArray(v) ? (v.length ? v.join(', ') : '—') : (v ?? '—');
    lines.push(`  ${k}: ${val}`);
  }
  lines.push('');

  if (fp.configFiles.length) {
    push('Config files');
    for (const f of fp.configFiles) lines.push(`  ${f}`);
    lines.push('');
  }

  if (Object.keys(fp.versions).length) {
    push('Key versions');
    for (const [k, v] of Object.entries(fp.versions)) lines.push(`  ${k}: ${v}`);
  }

  return lines.join('\n');
}
