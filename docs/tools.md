# Tool Reference

Every MCP tool this server exposes, with parameters and return shape. Tools fall into two groups: **LLM-oriented** (single-purpose, fast, chainable) and **Analysis** (broad overviews with filtering modes).

Pick LLM-oriented tools when you know what you want to look up. Pick analysis tools when you're surveying. A natural workflow:

> `get_project_fingerprint` → `find_symbol` → `get_component_props` / `get_hook_signature` / `find_references` → `analyze_imports` → edit.

All tools accept `format: 'text' | 'markdown' | 'json'` (default `json`). JSON is what the examples show.

### Pagination (1.5+)

Four tools can return unbounded lists and accept optional pagination:

- [`find_symbol`](#find_symbol)
- [`find_references`](#find_references)
- [`analyze_imports`](#analyze_imports) — paginates `incoming` only; `outgoing` is bounded by one file's import list
- [`analyze_routes`](#analyze_routes)

**Input (both optional):**

| Field | Type | Default | Limits |
|---|---|---|---|
| `limit` | number | 100 | 1..1000; values > 1000 are clamped with a `note` |
| `offset` | number | 0 | must be ≥ 0 |

`limit <= 0` or `offset < 0` is rejected with `Invalid arguments: …`.

**Output fields (in addition to each tool's own payload):**

| Field | Meaning |
|---|---|
| `total` | matches count **before** pagination |
| `limit` | applied limit (after clamping) |
| `offset` | applied offset |
| `hasMore` | `true` when more results exist beyond this page |
| `nextOffset` | offset to request the next page, or `null` when done |
| `note` | present only when `limit` was clamped |

To walk the full list, pass `nextOffset` back as `offset` until it returns `null`. For `analyze_imports`, pagination fields also appear (zeroed) when `direction: "outgoing"` so the response shape is stable.

Ordering per tool (deterministic across pages):

- `find_symbol` — `(file, line, column)`
- `find_references` — `(file, line, column)`
- `analyze_imports.incoming` — `(file, line)`
- `analyze_routes` — lexicographic by `path`

### Performance — session-scoped AST cache (1.6+)

The five LLM-oriented tools that parse JS/TS files (`find_symbol`,
`find_references`, `get_file_exports`, `get_component_props`,
`get_hook_signature`) share an in-memory parsed-AST cache keyed on
`(absFile, mtimeMs)` for the lifetime of the MCP server process.
Repeat calls to the same file are filesystem stats + map lookups, not
re-parses. In particular, paged calls (page 2 of `find_references`,
etc.) and natural chains like `find_symbol → get_component_props →
find_references` no longer pay the parse cost twice.

The cache is invalidated automatically when a file's mtime changes,
LRU-bounded at 500 entries, and not persisted across server restarts.
LLM clients can issue follow-up calls freely without worrying about
amortizing parse cost themselves.

---

## LLM-oriented tools

### `get_project_fingerprint`

Session-opener. No AST parsing — pure filesystem inspection, milliseconds.

**Parameters:** `{ format? }`

**Returns:** `{ framework, structure, tooling, stack, configFiles, versions }`
- `framework` — Next.js + React versions, router (`app`/`pages`/`mixed`), TypeScript on/off
- `structure` — `src`/`app`/`pages`/`components`/`lib`/`public` paths, `hasMiddleware`
- `tooling` — package manager, test framework, linter, formatter
- `stack` — styling (tailwind/emotion/…), state (zustand/redux/…), data-fetching (react-query/swr/trpc/…), forms, validation, i18n, auth, ORM, UI kit
- `configFiles` — detected config files
- `versions` — key dependency versions

Call this first to ground context before any expensive analysis.

---

### `get_project_overview`

Consolidated project state: fingerprint + route summary + code counts. More expensive than `get_project_fingerprint` — use it when you need counts.

**Parameters:** `{ format? }`

**Returns:** `{ name, version, fingerprint, routes: { …counts }, counts: { components, customHooks } }`

Under the hood delegates to `get_project_fingerprint` and `analyze_routes`. If you want the raw fingerprint, call that directly.

---

### `analyze_routes`

Routing graph: URL → file, with rendering mode, data-fetching strategy, dynamic segments, layout chain, and HTTP methods.

**Parameters:**
```json
{
  "path": "string (optional) — filter by exact URL or /prefix/** glob",
  "format": "text|markdown|json",
  "limit": "number (optional, 1..1000, default 100)",
  "offset": "number (optional, default 0)"
}
```

Response includes pagination metadata — see [Pagination](#pagination-15).

**Per-route fields:** `path`, `file`, `routerType` (`app`/`pages`), `kind` (`page`/`route-handler`/`api-route`), `rendering` (`server`/`client`/`null`), `dataFetching` (`async-rsc`/`gssp`/`gsp`/`route-handler`/`none`), `dynamicSegments`, `layoutChain` (App Router), `methods` (route handlers only).

**App Router specifics:**
- `(group)` / `@slot` segments stripped from URLs
- Intercepting routes (`(.)x`) skipped
- `'use client'` directive → client rendering
- Async default export → `async-rsc` data fetching

**Examples:**
```json
{"path": "/settings/**"}
{"path": "/api/users"}
```

**Known gap:** Pages Router API routes (`pages/api/*.ts`) don't extract HTTP methods — those inspect `req.method` at runtime.

---

### `analyze_imports`

Import graph for one file — both directions.

**Parameters:**
```json
{
  "file": "string — project-relative or absolute",
  "direction": "outgoing|incoming|both",
  "format": "text|markdown|json",
  "limit": "number (optional, paginates `incoming`)",
  "offset": "number (optional)"
}
```

**Returns:**
- `outgoing`: `{ local: [...], external: [...], unresolved: [...] }` — each entry has `source`, resolved file, `specifiers`, `kind` (`value`/`type`/`dynamic`/`re-export`), line number
- `incoming`: array of importers with their specifiers and line numbers, paginated — see [Pagination](#pagination-15)
- Unrequested direction is `null` (consistent response shape)

**Resolution handles:** relative paths with auto-extension probing, TS-ESM `./foo.js` → `./foo.ts` on disk, tsconfig `paths` aliases (`@/*`), `index.*` directory resolution, comment-tolerant `tsconfig.json` parsing.

---

### `find_symbol`

Locate declarations by name across the project. The glue between "I know the name" and tools that need a file path.

**Parameters:**
```json
{
  "name": "string — identifier (e.g. 'Button', 'useAuth')",
  "kind": "any|component|hook|function|type|interface|class|variable",
  "format": "text|markdown|json",
  "limit": "number (optional, 1..1000, default 100)",
  "offset": "number (optional, default 0)"
}
```

Response includes pagination metadata — see [Pagination](#pagination-15).

**Classification:**
- `useFoo` → `hook`
- PascalCase + body returns JSX → `component`
- Class extending `React.Component` / `PureComponent` → `component`
- Otherwise by declaration type

Each match: `file`, `name`, `kind`, `exported`, `default`, `line`, `column`, `returnsJsx` (when confident).

---

### `find_references`

Every place in the project that imports and uses a given symbol. Blast radius of a rename.

**Parameters:**
```json
{
  "symbol": "string — exported name",
  "file": "string — file that defines it",
  "format": "text|markdown|json",
  "limit": "number (optional, 1..1000, default 100)",
  "offset": "number (optional, default 0)"
}
```

Response includes pagination metadata — see [Pagination](#pagination-15). Note: pagination caps output size, not scan cost — the tool still walks every file to find references.

**Handles:** named imports (`import { A as B }`), default imports with any local alias, namespace imports (`* as ns` → reports `ns.symbol` member access), re-exports (`export { X } from …`), type-only imports.

**Reference kinds:** `import`, `call`, `jsx`, `type`, `identifier`.

**Barrel re-exports (1.7+):** importers that reach the target through one or more barrel files (`export { X } from '…'`, `export *`, `export { default as X } from '…'`, renamed chains) are reported as references to the target. When a reference passes through barrels, the `via` field on each `Reference` lists the chain — nearest-to-importer first, nearest-to-target last. Cycles are detected and broken; third-party sources (`export … from 'react'`) are not followed.

**Shadow-safe (1.7+):** identifier matching uses scope-aware binding lookup, so a local `const`, parameter, or destructured binding with the same name as the import is not counted as a reference.

---

### `get_component_props`

Prop surface of a named React component.

**Parameters:**
```json
{
  "component": "string",
  "file": "string — file that defines it",
  "format": "text|markdown|json"
}
```

**Returns:** `{ name, file, found, componentKind: 'function'|'arrow'|'class'|'unknown', propsTypeSource, propsTypeName, propsTypeFile, props: [{ name, type, required }], notes }`

`propsTypeSource` values:
- `inline` — `props: { a: string }`
- `local-interface` / `local-type` — same file declaration
- `imported-interface` / `imported-type` — one-hop import, `propsTypeFile` populated
- `composed` — top-level intersection or utility type
- `imported-unresolved` — import target couldn't be opened
- `unresolved` — type too dynamic to extract

**Supports:**
- Function, arrow, class components (incl. `extends React.Component<Props>`)
- Inline object types, local interfaces/type aliases, one-hop imported types
- Renamed imports (`import { A as B }`)
- **Composed types (1.4+):** intersections (`A & B`), interface `extends` chains, `Omit`/`Pick`/`Partial`/`Required`, and `React.FC<Props>` / `FC<Props>` / `FunctionComponent<Props>` / `VFC<Props>` generics on const declarations
- Intersections spanning imported + local types
- Cycle detection via visited set

**Known gaps:** mapped types (`{ [K in keyof T]: U }`), conditional types, multi-hop re-exports, default/namespace imports used as types, `Omit`/`Pick` keys given as type references rather than string-literal unions.

---

### `get_hook_signature`

Call signature of a named custom hook. Mirror of `get_component_props` for hooks.

**Parameters:**
```json
{
  "hook": "string — hook name (e.g. 'useAuth')",
  "file": "string — file that defines it",
  "format": "text|markdown|json"
}
```

**Returns:** `{ name, file, found, kind: 'function'|'arrow'|'unknown'|null, parameters: [{ name, type, required, destructured?, rest? }], returnType: string|null, notes }`

- `returnType` is `null` when the hook's return is inferred rather than explicitly annotated.
- Destructured params (`{ a, b }: Options`) appear as a single entry named `options` (or `tuple` for array destructuring) with `destructured: true` and the full annotation as `type`.
- Rest params get `rest: true` and `required: false`.
- Params with default values get `required: false`.

---

### `get_file_exports`

Every top-level export in a file. The question you ask before writing an import.

**Parameters:**
```json
{
  "file": "string",
  "format": "text|markdown|json"
}
```

**Per-export fields:** `name`, `kind`, `default`, `line`, `column`. Re-exports also carry `source` and `originalName` (when renamed).

**Kinds:** `component`, `hook`, `function`, `class`, `interface`, `type`, `enum`, `variable`, `re-export`, `re-export-all`, `re-export-ns`, `unknown`.

---

## Analysis tools

These are older, broader tools. All share a `mode` parameter:
- `all` — basic list of everything (default)
- `specific` — single target, matched by a pattern
- `detailed` — comprehensive inspection

And all accept `path` (directory filter) and `format`.

### `analyze_components`

**Parameters:**
```json
{
  "path": "string (optional)",
  "mode": "all|specific|detailed",
  "componentPattern": "string — e.g. 'Button', '*Modal', 'Auth*'",
  "includeProps": "boolean (default: false)",
  "includeHooks": "boolean (default: false)",
  "format": "text|markdown|json"
}
```

Returns a list of React components with optional props and hook-usage info.

---

### `analyze_hooks`

**Parameters:**
```json
{
  "path": "string (optional)",
  "mode": "all|specific|detailed",
  "hookPattern": "string — e.g. 'useState', 'use*'",
  "includeBuiltIn": "boolean (default: true)",
  "includeCustom": "boolean (default: true)",
  "format": "text|markdown|json"
}
```

Returns React hooks found in the project, separable into built-in vs custom.

---

### `analyze_pages`

**Parameters:**
```json
{
  "path": "string (optional — auto-detects pages/ or app/)",
  "mode": "all|specific|detailed",
  "pagePattern": "string — e.g. 'index', 'api/*', '[slug]'",
  "includeApiRoutes": "boolean (default: true)",
  "format": "text|markdown|json"
}
```

Older overlap with `analyze_routes`. `analyze_routes` is stricter and more LLM-friendly; `analyze_pages` still carries complexity scoring and directory-breakdown fields some callers rely on.

---

### `analyze_features`

**Parameters:**
```json
{
  "path": "string (default: 'src')",
  "mode": "all|specific|detailed",
  "featurePattern": "string — e.g. 'auth', '*admin*'",
  "includeTypes": "boolean (default: false)",
  "format": "text|markdown|json"
}
```

Groups code by feature/module directory. Use `includeTypes: true` to pull TS type info.

---

### `analyze_patterns`

**Parameters:**
```json
{
  "path": "string (optional)",
  "mode": "all|specific|detailed",
  "patternType": "hooks|context|hoc|render-props|all",
  "patternPattern": "string — e.g. 'withAuth', '*Provider'",
  "format": "text|markdown|json"
}
```

Detects React patterns: hooks, Context providers/consumers, higher-order components, render-props.

---

### `analyze_i18n`

Detect untranslated strings and missing translation keys using a 7-validator system. See [docs/i18n.md](i18n.md) for what each validator covers.

**Parameters:**
```json
{
  "path": "string (optional)",
  "functions": "comma-separated — e.g. 't,translate,$t,i18n.t' (default)",
  "minLength": "number 1–100 (default: 3)",
  "languages": "comma-separated — e.g. 'en,es,fr,de' (default)",
  "jsxText": "boolean (default: true)",
  "stringLiterals": "boolean (default: true)",
  "format": "text|markdown|json"
}
```

---

### `get_help`

Returns help metadata for the shipped tools. Falls back to a static list if plugin-based help isn't available.

**Parameters:** `{ command?, format? }`

---

## Pattern matching

Where a tool accepts a pattern (`componentPattern`, `hookPattern`, `pagePattern`, `featurePattern`, `patternPattern`):

| Pattern | Matches |
|---|---|
| `Button` | Exact name |
| `*Modal` | Ends with `Modal` |
| `Auth*` | Starts with `Auth` |
| `*Admin*` | Contains `Admin` |

---

## Return-shape conventions

- Every tool that fails returns `{ isError: true, content: [{ type: 'text', text: 'Error: ...' }] }` at the MCP wire level.
- Successful JSON responses are a single text block whose content is `JSON.stringify(result, null, 2)`.
- `null` means "not applicable" (e.g., `returnType: null` when a hook's return is inferred), not "missing data".
- Empty arrays mean "no matches", never missing fields.
