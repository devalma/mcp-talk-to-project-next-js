/**
 * Shared module-path resolver.
 *
 * Used by analyze-imports, find-references, and get-component-props to
 * resolve `import` / `export from` source strings to concrete file paths.
 *
 * Handles:
 *  - Relative paths with automatic extension probing
 *  - TS-ESM/NodeNext './foo.js' → './foo.ts' disk mapping
 *  - Directory imports via index.* resolution
 *  - tsconfig.json compilerOptions.paths aliases (e.g. "@/*": ["src/*"])
 *  - Comment-tolerant tsconfig.json parsing (JSON-with-comments)
 *
 * External packages (non-relative, non-aliased) return null.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface TsconfigAlias {
  prefix: string;
  targets: string[];
}

const CANDIDATE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

export function readTsconfigPaths(projectPath: string): TsconfigAlias[] {
  const aliases: TsconfigAlias[] = [];
  const tsconfigPath = path.join(projectPath, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) return aliases;

  let tsconfig: any;
  try {
    const raw = fs.readFileSync(tsconfigPath, 'utf-8');
    tsconfig = JSON.parse(stripJsonComments(raw));
  } catch {
    return aliases;
  }

  const baseUrl: string = tsconfig.compilerOptions?.baseUrl || '.';
  const paths: Record<string, string[]> = tsconfig.compilerOptions?.paths || {};
  const baseAbs = path.resolve(projectPath, baseUrl);

  for (const [pattern, targets] of Object.entries(paths)) {
    aliases.push({
      prefix: pattern.replace(/\*$/, ''),
      targets: (targets as string[]).map((t) =>
        path.resolve(baseAbs, t.replace(/\*$/, ''))
      ),
    });
  }
  return aliases;
}

export function stripJsonComments(raw: string): string {
  return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

export function matchesAlias(source: string, prefix: string): boolean {
  return source === prefix.replace(/\/$/, '') || source.startsWith(prefix);
}

export function isExternalPackage(source: string, aliases: TsconfigAlias[]): boolean {
  if (source.startsWith('.') || source.startsWith('/')) return false;
  for (const a of aliases) if (matchesAlias(source, a.prefix)) return false;
  return true;
}

/**
 * Resolve an import source to a project-relative file path. Returns null for
 * external packages and for anything that can't be resolved on disk.
 */
export function resolveImportSource(
  source: string,
  fromAbsFile: string,
  projectPath: string,
  aliases: TsconfigAlias[]
): string | null {
  const basePaths = expandAlias(source, fromAbsFile, aliases);
  if (!basePaths) return null;

  for (const { basedir, rest } of basePaths) {
    const base = rest.startsWith('/') ? rest : path.resolve(basedir, rest);
    const resolved = tryResolveBase(base, projectPath);
    if (resolved) return resolved;
  }
  return null;
}

interface AliasExpansion {
  basedir: string;
  rest: string;
}

function expandAlias(
  source: string,
  fromAbsFile: string,
  aliases: TsconfigAlias[]
): AliasExpansion[] | null {
  if (source.startsWith('.') || source.startsWith('/')) {
    return [{ basedir: path.dirname(fromAbsFile), rest: source }];
  }
  const expansions: AliasExpansion[] = [];
  for (const a of aliases) {
    if (!matchesAlias(source, a.prefix)) continue;
    const remainder = source.slice(a.prefix.length) || '.';
    for (const target of a.targets) {
      expansions.push({ basedir: target, rest: remainder });
    }
  }
  return expansions.length ? expansions : null;
}

function tryResolveBase(base: string, projectPath: string): string | null {
  // Direct file with existing extension
  if (/\.[jt]sx?$|\.mjs$|\.cjs$/.test(base) && isFile(base)) {
    return toProjectRelative(base, projectPath);
  }

  // TS-ESM/NodeNext: imports like './foo.js' map to './foo.ts' on disk.
  const jsExtMatch = /\.(jsx?|mjs|cjs)$/.exec(base);
  if (jsExtMatch) {
    const withoutExt = base.slice(0, -jsExtMatch[0].length);
    const tsCandidates =
      jsExtMatch[1] === 'jsx' ? ['.tsx', '.jsx'] : ['.ts', '.tsx', '.js', '.jsx'];
    for (const ext of tsCandidates) {
      const candidate = withoutExt + ext;
      if (isFile(candidate)) return toProjectRelative(candidate, projectPath);
    }
  }

  // Add extensions
  for (const ext of CANDIDATE_EXTS) {
    const candidate = base + ext;
    if (isFile(candidate)) return toProjectRelative(candidate, projectPath);
  }

  // index.* inside directory
  if (isDir(base)) {
    for (const ext of CANDIDATE_EXTS) {
      const candidate = path.join(base, 'index' + ext);
      if (isFile(candidate)) return toProjectRelative(candidate, projectPath);
    }
  }

  return null;
}

export function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

export function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function toProjectRelative(absPath: string, projectPath: string): string {
  return path.relative(projectPath, absPath).replace(/\\/g, '/');
}
