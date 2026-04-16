# Next Steps / Handoff Notes

Pragmatic guide for the next developer. Captures known limitations, natural extensions, and hygiene items that emerged during the 1.3.0 work. Ranked by impact — start at the top, stop when time runs out.

## 1. Known gaps in new tools

These are bounded, acknowledged, and have explicit notes at call sites. If a user hits one, the tool reports the limitation rather than guessing — so extensions are additive, not breaking.

### `find_references` — shadow detection
- **File:** [src/tools/find-references.ts](../src/tools/find-references.ts)
- **Gap:** No scope analysis. A local variable that shadows the imported name gets counted as a reference.
- **Fix sketch:** Track identifier bindings per scope while walking. `@babel/traverse` has scope support; we intentionally avoided it to skip the ESM-default-export interop dance (see commit `11b1a3c`). When adding scope, confirm the import still works cleanly with the project's `"type": "module"` setup.
- **Priority:** Medium — shadowing is rare in clean code, but silently wrong answers erode trust.

### `get_component_props` — intersection / extends / generics
- **File:** [src/tools/get-component-props.ts](../src/tools/get-component-props.ts)
- **Gap:** When the prop type is `A & B`, `extends Base`, `Omit<T, 'x'>`, or a mapped type, the tool reports `propsTypeSource: 'unresolved'` with a note. Also skips default and namespace imports as types (rare).
- **Fix sketch:**
  - **Intersection:** recursively resolve each side, merge members (handle overrides). Same algorithm for `interface X extends Y`.
  - **Generic React.FC<Props>:** unwrap the type argument and re-enter extraction.
  - **Utility types (`Omit`, `Pick`, `Partial`):** handle the common cases by rewriting the member list. TS has a lot of these; 80/20 pick: `Partial`, `Required`, `Omit`, `Pick`.
- **Priority:** High — modern React codebases lean heavily on intersections and utility types.

### `analyze_imports` / `find_references` — multi-hop re-exports
- **Gap:** Barrel files that re-export (`export { X } from './y'`) are treated as a direct import of `y`. If you search for references to a symbol and an importer goes through a barrel, the barrel shows as the importer rather than the eventual consumer.
- **Fix sketch:** Add a "follow re-exports" pass that collapses barrel hops. Risk: false attribution if a re-export renames the symbol through a chain.
- **Priority:** Medium — common in larger codebases with `index.ts` barrels.

### `analyze_routes` — Pages Router HTTP methods
- **File:** [src/tools/analyze-routes.ts](../src/tools/analyze-routes.ts)
- **Gap:** Pages Router API routes (`pages/api/*.ts`) don't extract HTTP methods. Unlike App Router route handlers (which export `GET`, `POST`, etc.), Pages Router API handlers inspect `req.method` at runtime.
- **Fix sketch:** Parse the default-export handler body and collect `req.method === 'X'` checks. Reasonable heuristic, will miss dynamic cases.
- **Priority:** Low — Pages Router is legacy for new code; don't invest heavily.

### `find_symbol` — composition components
- **File:** [src/tools/find-symbol.ts](../src/tools/find-symbol.ts)
- **Gap:** Classification relies on "body contains JSX." Components that delegate entirely (`const X = memo(InnerX)`, HOC returns) get classified as `function`.
- **Fix sketch:** Detect wrapping patterns (`memo`, `forwardRef`, `styled.X\``, `withXxx`). Can be a shallow extra check in `classifyFunctionKind`.
- **Priority:** Low-medium — `returnsJsx: false` is still informative; LLMs can deduce.

### Tsconfig `paths` — multiple targets
- **File:** [src/tools/shared/module-resolver.ts](../src/tools/shared/module-resolver.ts)
- **Gap:** When `"@/*": ["./src/*", "./app/*"]`, we try targets in order and return the first resolvable match. Correct-ish but not fully spec-compliant — TS uses a specific fallback order based on file existence and module resolution strategy.
- **Priority:** Low — rare to have multiple targets.

---

## 2. Natural tool extensions (ranked)

### High value

1. **`get_file_exports(file)`** — what does this file expose? Needed before writing an import. Lightweight to implement: parse, collect `export` declarations and re-exports, classify each by kind (already have the classifier from `find_symbol`).

2. **`get_hook_signature(name, file)`** — like `get_component_props` but for custom hooks. Returns `{ parameters: [{name, type, required}], returnType: string | null }`. React apps are hook-heavy; this is the missing mirror.

3. **Pagination / token budgeting** — large projects produce large outputs. Add `limit` + `offset` to `find_references`, `find_symbol`, `analyze_routes`, `analyze_imports`. The MCP response is one text blob; chunking means LLMs don't blow context on noise.

4. **AST cache within a session** — every call re-parses files it has already seen. In-memory map keyed by `(absPath, mtime)` invalidated on file change would cut repeat-call latency by an order of magnitude. See how `analyze_imports.extractImports` and `find_references.collectReferencesInFile` both parse the same files.

### Medium value

5. **`get_context_providers(file)`** — walk parents in the JSX render tree and list every Context.Provider in effect. Next.js apps lean on context heavily and LLMs often don't know what's in scope.

6. **`analyze_server_actions`** — find every `'use server'` directive and its exported actions with signatures. This is first-class Next.js 14+ surface and not covered elsewhere.

7. **Usage counts in `find_symbol`** — optionally include reference count per match (`usages: number`) so LLMs can rank by importance. Expensive but bounded.

### Low value (don't rush)

8. Class component prop extraction via `componentDidMount` / `state` analysis — class components are legacy for new code.
9. Enum extraction as a separate `find_symbol` kind — TS enums are niche.

---

## 3. Code hygiene

### Cognitive complexity warnings
Several functions exceed the SonarQube threshold of 15:
- [src/tools/find-references.ts](../src/tools/find-references.ts): `findMatchingImports`, `findLocalNameUsages`, `classifyIdentifier`, `collectReferencesInFile`
- [src/tools/get-component-props.ts](../src/tools/get-component-props.ts): `extractPropsFromType`, `resolveImportedType`

These are AST walkers where the complexity is intrinsic (one branch per node type). Splitting them into named helpers per branch would lower the number but not the understanding burden. **Recommendation: leave as-is unless you're there for other reasons.** If you do split, keep related branches together — don't spread the dispatch across multiple files.

### Type tightening
Every AST node is `any`. Using `@babel/types` (already a dependency) would type-narrow properly:
```ts
import * as t from '@babel/types';
if (t.isImportDeclaration(node)) { /* node is typed */ }
```
Biggest win in [src/tools/find-references.ts](../src/tools/find-references.ts) and [src/tools/get-component-props.ts](../src/tools/get-component-props.ts) where the `any` is most pervasive.

### Legacy `analyze_pages` vs new `analyze_routes`
- [src/plugins/page-extractor/plugin.ts](../src/plugins/page-extractor/plugin.ts) and [src/tools/analyze-pages.ts](../src/tools/analyze-pages.ts) now partially overlap with `analyze_routes`.
- `analyze_routes` is stricter and more LLM-friendly; `analyze_pages` has legacy fields (complexity scoring, routesByDirectory breakdown) that some consumers may rely on.
- **Recommendation:** Keep both for 1.x; deprecate `analyze_pages` in 2.0 notes. Direct new users to `analyze_routes`.

---

## 4. Testing

### What exists
- 252 unit tests across validators, new tools, and helpers
- Temp-fixture pattern: write files to a temp dir, run the function, assert
- ~500ms total runtime, good enough for tight loops

### What's missing

1. **Integration tests against the MCP handler** — all tests call the pure functions directly (`findSymbol`, `analyzeRoutes`, etc.). None go through `executeTool()` to verify the wire-level shape matches the declared JSON schemas.
   - **Suggested fix:** Add `tests/integration/mcp-handler.test.ts` that constructs a fake `ToolContext` and dispatches through `executeTool` for each tool.

2. **Real-project smoke tests** — `demo-project/` is minimal. Smoke tests against a real Next.js template (e.g., `create-next-app` output) would catch issues the fixtures miss.
   - **Suggested fix:** Check a small fixture project into `tests/fixtures/nextjs-starter/` and run each tool against it as an integration test.

3. **Performance regression tracking** — no budget assertions. If `analyze_imports` incoming scan becomes 10× slower on a change, nothing catches it.
   - **Suggested fix:** Add a few `bench` tests using `vitest bench` on representative fixtures; fail the build if they regress >50%.

4. **Legacy tool coverage** — the 6 new tools have dense tests. The older tools (`analyze_components`, `analyze_hooks`, `analyze_pages`, `analyze_features`, `analyze_patterns`) have **zero** test coverage. If you refactor them, you're flying blind.

---

## 5. Documentation

### Docs that may have drifted (not updated in 1.3.0)
- [docs/getting-started.md](getting-started.md) — still references the pre-1.3.0 tool set
- [docs/quick-reference.md](quick-reference.md) — ditto
- [docs/plugin-development.md](plugin-development.md) — still accurate (plugin API unchanged)
- [USAGE.md](../USAGE.md) — CLI-focused; hasn't been rechecked against current `cli.js` behavior
- [docs/common-utilities.md](common-utilities.md) — references the `src/plugins/common/` utility layer; still accurate but may not cover newer helpers

### Dynamic help output
[src/tools/help.ts](../src/tools/help.ts) and [src/plugins/help-extractor/plugin.ts](../src/plugins/help-extractor/plugin.ts) generate help from **plugin** metadata, not from the new **tool** definitions. The new LLM-oriented tools (fingerprint, routes, imports, symbol, references, component-props) will not appear in help output.
- **Fix:** Extend help-extractor to include entries from `getAllTools()` in `src/tools/index.ts`, or write a second help plugin that introspects tools.

### Large, monolithic README
[README.md](../README.md) is 1097 lines. Most users never get past the first screen. Consider splitting: `README.md` stays minimal (elevator pitch + install + top-3 tools), detailed tool docs move to `docs/tools.md`.

---

## 6. Infrastructure

### Missing
- **No ESLint / Prettier / Biome config.** TypeScript strict-mode catches correctness; style drifts. Adding Biome (single tool, fast) would give lint + format in one pass.
- **No pre-commit hook.** `tsc --noEmit` + `vitest run` would catch 95% of what breaks CI.
- **No test coverage reporting.** `vitest run --coverage` works out of the box; just wire it into CI and publish to Codecov (or keep as an artifact).
- **No Dependabot / Renovate config.** We already have known npm-audit warnings from the transitive deps (3 high, 1 moderate). Automated bumps + a monthly review would keep this in check.

### Release engineering
- **Manual `npm publish`.** No automation. Consider either:
  - `changesets` — more control, requires changeset files per change
  - `semantic-release` — full auto, requires Conventional Commits
- **No GitHub Releases entry for 1.3.0.** The tag exists; a Release with the CHANGELOG entry pasted as release notes would improve discoverability.
- **`.npmignore` hasn't been audited post-1.3.0.** Confirm the publish tarball doesn't include `tests/`, `docs/`, `demo-project/` (it shouldn't — already excluded — but worth a `npm pack --dry-run` sanity check).

---

## 7. Architectural opportunities

### Tool chaining pattern
The natural LLM workflow is `find_symbol → get_component_props / find_references → analyze_imports`. Consider a **composite tool** that does this chain in one call for a given name. Convenience at the cost of flexibility — worth prototyping to see if it's sticky.

### Plugin vs tool distinction
- **Plugins** (in [src/plugins/](../src/plugins/)) run through the plugin manager and power `analyze_*` tools.
- **Tools** (in [src/tools/](../src/tools/)) are a mix: some delegate to plugins (`analyze_components`), others are self-contained (the 6 new ones).
- The line is fuzzy. For new work, prefer self-contained tools with functions pure enough to unit-test directly. Plugins made sense when there was a single `execute` surface; with 14 tools the plugin abstraction adds more overhead than leverage.

### Shared resolver ownership
[src/tools/shared/module-resolver.ts](../src/tools/shared/module-resolver.ts) is now used by three tools. If a fourth tool needs module resolution, keep it here. If the resolver grows (e.g., full TS `moduleResolution` spec compliance), consider moving it under `src/shared/` at the top level so non-tool code can use it too.

---

## 8. Things to not do

- **Don't delete `docs/api-reference.md`** without migrating its contents. It still has valuable legacy schema docs that this handoff doesn't duplicate.
- **Don't move the i18n validators.** They're well-factored and the test surface is the strongest part of the codebase.
- **Don't chase SonarQube warnings as the primary quality metric.** Many are stylistic noise (sequential `.push()`, `!` non-null in tests); the cognitive complexity ones flag real AST walkers that are complex for a reason.
- **Don't start a full rewrite** of the legacy `analyze_*` tools. They work, they have consumers, and rewriting is almost always more expensive than planned. If you need a better shape, add a new tool and deprecate the old one over two releases.

---

## Quick reference: where things are

| What | Where |
|---|---|
| MCP server entry | [src/index.ts](../src/index.ts) |
| Tool registry | [src/tools/index.ts](../src/tools/index.ts) |
| Plugin registry | [src/plugins/registry.ts](../src/plugins/registry.ts) |
| Shared AST utilities | [src/plugins/common/ast-utils.ts](../src/plugins/common/ast-utils.ts) |
| Shared module resolver | [src/tools/shared/module-resolver.ts](../src/tools/shared/module-resolver.ts) |
| Test fixtures pattern | [tests/tools/analyze-routes.test.ts](../tests/tools/analyze-routes.test.ts) — good template |
| CI workflow | [.github/workflows/ci.yml](../.github/workflows/ci.yml) |
