# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.1] - 2026-04-16

### Changed
- **Doc rework.** Consolidated ~6000 lines of documentation across 12
  files down to ~2500 lines across 7 files, with one source of truth
  per topic.
  - `README.md` reduced from 1133 lines to 115 — pitch, install, core
    workflow, links out.
  - New `docs/tools.md` — canonical per-tool reference for all 16
    MCP tools; parameters and return shapes derived from source.
  - New `docs/i18n.md` — merged `docs/i18n-translatable-strings.md`,
    `docs/i18n-validators.md`, and `docs/string-contexts-analysis.md`
    into a single intent → validators → decision-tree doc.
  - `docs/getting-started.md` rewritten against actual server behavior
    (env vars, MCP-client config variants, troubleshooting).
  - `docs/plugin-development.md` and `docs/common-utilities.md` carry a
    "verify against source" banner since internal APIs drift.
- **CI: Node matrix updated to `[20.19, 22]`.** Previous `[18.x, 20.x]`
  could not satisfy vitest 4's `^20.19 || >=22.12` engine constraint.
- **CI: `npm ci` → `npm install --no-audit --no-fund`.** The lockfile
  is generated on macOS and npm's strict optional-dep check rejects
  platform-specific rolldown bindings on Linux runners.

### Removed
- `USAGE.md`, `docs/README.md`, `docs/api-reference.md`,
  `docs/quick-reference.md`, `docs/i18n-translatable-strings.md`,
  `docs/i18n-validators.md`, `docs/string-contexts-analysis.md`,
  `docs/plugins/` — content consolidated into the new layout.
- References to phantom tools (`analyze_dependencies`, `get_metrics`,
  `search_code`, `.mcp-config.json`) that never existed.

### Fixed
- Broken cross-references to removed docs.
- Stale Node version requirements (18+ → 20.19+) in getting-started.

## [1.4.0] - 2026-04-16

### Added
- **`get_file_exports` MCP tool** — lists every top-level export of a file
  with name, kind (component / hook / function / class / interface / type /
  enum / variable), `default` flag, and line/column. Also records
  re-exports: `export { X } from './y'` (`kind: re-export`),
  `export * from './y'` (`kind: re-export-all`), and
  `export * as ns from './y'` (`kind: re-export-ns`). Answers the question
  before every import: "what does this file expose?"
- **`get_hook_signature` MCP tool** — mirror of `get_component_props` for
  custom hooks. Returns each parameter (`name`, `type` as TS source text,
  `required`, plus `destructured` / `rest` flags) and the explicit
  `returnType` annotation (null when inferred). Handles function
  declarations, arrow functions, object/array destructuring, rest params,
  and default-value optionality.

### Changed
- **`get_component_props` now resolves composed types.** Previously returned
  `unresolved` for intersections / `extends` / utility types; now fully
  handles them:
  - `A & B` — resolves each side and merges members (later wins on name
    conflict). Top-level unnamed intersection surfaces as
    `propsTypeSource: 'composed'`.
  - `interface X extends Base1, Base2 { … }` — recursively resolves each
    base, then applies own members (own wins).
  - `Omit<T, K>` / `Pick<T, K>` with string-literal key unions — filters
    members accordingly.
  - `Partial<T>` / `Required<T>` — flips the `required` flag on every
    member.
  - `const X: React.FC<Props> = …` / `FC<Props>` / `FunctionComponent<Props>` /
    `VFC<Props>` — reads the generic type argument from the variable's
    annotation, not just the param.
  - Intersections of imported + local types are resolved across files.
  - Circular type references are detected and reported via a note instead
    of infinite-looping.
- **Shared classifier** extracted to `src/tools/shared/classify.ts`
  (`classifyFunctionKind`, `functionReturnsJsx`, `extendsReactComponent`).
  `find_symbol` and the two new tools share it — one source of truth for
  "is this a component/hook/function?".

## [1.3.0] - 2026-04-16

### Added
- **Six new LLM-oriented MCP tools** designed to answer the questions an LLM
  asks while editing a Next.js project. Each is single-purpose, fast, and
  returns structured JSON that can be chained into the next call.
  - `get_project_fingerprint` — fast session-opener: framework, router,
    structure, package manager, test framework, linter, and detected stack
    (styling, state, data fetching, forms, validation, i18n, auth, ORM, UI
    kit). Pure filesystem inspection, milliseconds.
  - `analyze_routes` — routing graph: URL → file, rendering mode
    (server/client), data-fetching (`async-rsc`/`gssp`/`gsp`/`route-handler`),
    dynamic segments, layout chain (App Router), HTTP methods (route
    handlers). Correctly strips `(group)` and `@slot` segments, skips
    intercepting routes. Supports `path` filter with `/prefix/**` globs.
  - `analyze_imports` — bidirectional import graph for a file. Outgoing
    imports classified as local / external / unresolved with resolved paths;
    incoming shows every importer with specifiers and line numbers. Handles
    TS-ESM `./foo.js` → `./foo.ts` mapping, tsconfig `paths` aliases,
    `index.*` directory resolution, and comment-tolerant `tsconfig.json`.
  - `find_symbol` — locate declarations by name project-wide. Classifies as
    component / hook / function / type / interface / class / variable using
    AST heuristics (JSX presence, `useXxx` naming, `extends React.Component`).
  - `find_references` — every place that imports and uses a given symbol,
    with file/line/column and kind (import / call / jsx / type / identifier).
    Handles renamed imports, default imports with any local alias, namespace
    imports via member access, and re-exports.
  - `get_component_props` — prop surface of a named React component.
    Supports function / arrow / class components, inline object types, local
    interfaces and type aliases, and one-hop imported types (reports
    `propsTypeFile`).

- **Consolidated module resolver** shared across `analyze_imports`,
  `find_references`, and `get_component_props` at
  `src/tools/shared/module-resolver.ts`.
- **Vitest test suite** — 252 tests across 16 files (validators, new tools,
  helpers). ~500ms full run.
- **GitHub Actions CI** — build + test on Node 18 and 20 for push/PR to main.

### Changed
- **`get_project_overview` rewritten** to delegate to `get_project_fingerprint`
  + `analyze_routes` (no more duplicated framework-version / router /
  directory-flag detection). Output shape now:
  `{ name, version, fingerprint, routes: {...counts}, counts: {components, customHooks} }`.
- **Consolidated i18n docs** — `docs/translatable-whitelist.md` +
  `docs/translation-whitelist.md` merged into
  `docs/i18n-translatable-strings.md`.

### Removed
- `src/index-new.ts` — unused parallel rewrite (no references anywhere).
- `src/container/` (DI container) + `src/interfaces/container.ts` — zero
  imports in codebase, fully dead code.
- `"test": "node test.js"` script — the `test.js` file didn't exist.

### Fixed
- `analyze_imports` resolver now handles TS-ESM/NodeNext convention where
  `./foo.js` imports resolve to `./foo.ts` / `./foo.tsx` on disk.

## [1.2.0] - 2025-07-25

### Added
- 🎯 **Advanced 7-Validator i18n System** - Complete rewrite with specialized validators
  - **Validator 1**: JSX Text Content (HIGH) - Direct text in JSX elements
  - **Validator 2**: User-facing JSX Attributes (HIGH) - alt, title, placeholder, label attributes  
  - **Validator 3**: User Message Variables (HIGH) - Variables with semantic names (*Message, *Text, *Label)
  - **Validator 4**: User-facing Object Properties (MEDIUM) - Object properties with semantic keys
  - **Validator 5**: Form Validation Messages (MEDIUM) - Validation error and success messages
  - **Validator 6**: Component Props (MEDIUM) - Props passed to React components vs HTML attributes
  - **Validator 7**: Alert Messages (MEDIUM) - User-facing alert(), confirm(), prompt() (excludes console.log)

- 🔍 **Smart Detection Features**
  - Whitelist-based approach prevents false positives from technical strings
  - Component vs HTML element distinction for accurate prop/attribute classification
  - Technical string filtering (CSS classes, API endpoints, debug messages, paths)
  - Natural language pattern detection with content validation
  - Zero false positives for technical identifiers like "react", "primary", "hovered"

- 🎯 **Path Targeting Capability**
  - Analyze specific directories: `node cli.js /path/to/project/src/components i18n`
  - Single file analysis: `node cli.js /path/to/project/file.tsx i18n`
  - Focused analysis for large projects with `--path` option
  - CLI enhancements for targeted translation work

- 🏗️ **Modular Validator Architecture**
  - Separate validator files under `src/plugins/i18n-extractor/validators/`
  - BaseValidator abstract class with consistent interface
  - ValidatorRegistry for centralized management
  - Easy to extend with additional validators

- 📊 **Enhanced Output & Reporting**
  - Detailed categorization by validator type (jsx-text, component-prop, alert-message, etc.)
  - Priority-based recommendations (HIGH/MEDIUM priority)
  - JSON output format with complete metadata
  - Comprehensive documentation with examples

### Improved  
- **False Positive Prevention**: Eliminated detection of technical strings through sophisticated whitelist approach
- **Component Detection**: Smart distinction between React component props and HTML attributes
- **Performance**: Modular architecture improves maintainability and performance
- **Documentation**: Complete validator system documentation with examples and usage patterns

### Technical
- Modular validator system with registry pattern
- Enhanced AST analysis with context-aware detection
- Comprehensive test coverage with demo files for each validator
- Clean separation of concerns between validation logic and AST traversal

## [1.1.0] - 2025-07-25

### Added
- 🌍 **i18n Translation Analyzer Plugin** - Comprehensive internationalization analysis
  - Automatic language detection from directory structure and config files
  - Untranslated string detection in source code
  - Missing translation key identification across language files
  - Translation coverage analysis and reporting
  - Modular architecture with dedicated components:
    - `LanguageDetector` - Smart language detection avoiding false positives
    - `ASTAnalyzer` - Advanced string extraction using Babel AST parsing
    - `TranslationFileAnalyzer` - JSON translation file validation and analysis
    - `ResultProcessor` - Intelligent result aggregation and formatting
  - CLI integration with flexible filtering and output formats
  - Support for popular i18n libraries (react-i18next, next-i18next)
  - Performance optimizations with caching and parallel processing
- `analyze_i18n` MCP tool for translation analysis
- Comprehensive documentation for i18n plugin architecture and usage

### Improved
- Plugin development documentation with real-world modular architecture example
- Enhanced BaseExtractor pattern documentation
- Updated README with i18n capabilities and usage examples

### Features
- **i18n Analysis**: Complete translation coverage analysis for internationalized projects
- **Language Detection**: Smart automatic detection from multiple sources (directories, config files, translation files)
- **String Analysis**: AST-based detection of untranslated strings in JavaScript/TypeScript code
- **Translation Management**: JSON translation file validation and missing key detection
- **Modular Architecture**: Clean separation of concerns with focused, reusable components
- **Performance Optimized**: Caching, parallel processing, and smart file filtering
- **CLI Integration**: Flexible command-line interface with multiple output formats

### Technical Details
- Modular plugin architecture with 7 focused components
- Advanced language detection avoiding false positives from node_modules
- Babel AST parsing for accurate string extraction from JSX and template literals
- JSON translation file processing with nested key support
- Intelligent result aggregation and formatting
- Support for complex i18n setups and multiple locale directories

## [1.0.0] - 2025-07-24

### Added
- Initial release of Next.js Project Analyzer MCP Server
- Comprehensive AST-based analysis of Next.js projects
- Support for React components, hooks, pages, features, and patterns
- Three analysis modes: `all`, `specific`, and `detailed`
- Multiple output formats: `text`, `markdown`, and `json`
- Pattern matching capabilities for targeted analysis
- MCP tools for Claude Desktop integration:
  - `analyze_components` - React component analysis
  - `analyze_hooks` - Hook usage analysis
  - `analyze_pages` - Next.js page and routing analysis
  - `analyze_features` - Feature and module organization
  - `analyze_patterns` - Architecture pattern detection
  - `get_project_overview` - Project structure and statistics
  - `get_help` - Documentation and usage help
- Plugin architecture for extensibility
- Support for both JavaScript and TypeScript projects
- AST caching for improved performance
- Comprehensive documentation and examples
- npx support for easy installation and usage
- CLI interface for testing and standalone usage
- Demo project for testing functionality

### Features
- **Component Analysis**: Extract props, hooks usage, dependencies, and metadata
- **Hook Analysis**: Detect custom hooks, built-in hook usage, and signatures
- **Page Analysis**: Next.js routing structure, data fetching methods, API routes
- **Feature Analysis**: Module organization, shared components, business logic
- **Pattern Analysis**: React patterns (Context, HOCs, Render Props), Next.js patterns
- **Project Overview**: Complete project structure, technology stack, statistics
- **Pattern Matching**: Glob-style patterns for targeting specific elements
- **Flexible Output**: Human-readable text, structured markdown, machine-readable JSON

### Technical Details
- Built with TypeScript for type safety
- Uses Babel parser for AST generation
- Plugin-based architecture for modularity
- MCP (Model Context Protocol) compliance
- Node.js 18+ support
- Comprehensive error handling and validation

### Documentation
- Complete README with installation and usage instructions
- API reference documentation
- Getting started guide
- Usage examples and patterns
- Plugin development guide
- Troubleshooting guide

### Configuration
- Environment variable configuration
- Claude Desktop integration
- Multiple project support
- Development and production modes
- Caching and performance options
