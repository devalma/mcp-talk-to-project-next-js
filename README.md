# Next.js Project Analyzer MCP Server

[![npm version](https://badge.fury.io/js/mcp-talk-to-project-next-js.svg)](https://badge.fury.io/js/mcp-talk-to-project-next-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server that provides comprehensive analysis of Next.js projects using Abstract Syntax Tree (AST) parsing. This server enables AI assistants to understand Next.js codebases by extracting detailed information about components, hooks, pages, features, and architectural patterns with **advanced i18n translation detection**.

## 🚀 Quick Start

### Installation

```bash
# Install globally
npm install -g mcp-talk-to-project-next-js

# Or install locally
npm install mcp-talk-to-project-next-js
```

### CLI Usage

```bash
# Analyze entire project for translations
nextjs-i18n /path/to/your/nextjs/project i18n --format=json

# Focus on specific directory
nextjs-i18n /path/to/project/src/components i18n --format=text

# Single file analysis
nextjs-i18n /path/to/project/src/pages/dashboard.tsx i18n

# Get help
nextjs-i18n --help
```

### MCP Server Usage

Add to your Claude Desktop configuration:
```json
{
  "mcpServers": {
    "nextjs-analyzer": {
      "command": "npx",
      "args": ["mcp-talk-to-project-next-js"],
      "env": {
        "NEXTJS_PROJECT_PATH": "/path/to/your/nextjs/project"
      }
    }
  }
}
```

## 🚀 Key Features

### 📦 Advanced Component Analysis
- **Three Analysis Modes**: All components (overview), specific components (pattern matching), detailed analysis (comprehensive)
- **Component Discovery**: List all React components (functional and class-based) across the entire project
- **Props Information**: Extract component props, their types, and default values
- **Hook Usage**: Show which hooks each component uses
- **Component Dependencies**: List imports and exports between components
- **Component Metadata**: Get component names, file locations, and export types
- **Pattern Matching**: Target specific components using patterns like "Button", "*Modal", "Auth*"

### 🎣 Comprehensive Hook Analysis
- **Custom Hook Detection**: Find all custom hooks in the project
- **Built-in Hook Usage**: List usage of useState, useEffect, useContext, etc.
- **Hook Dependencies**: Show hook dependency arrays and what they depend on
- **Hook Signatures**: Extract what each hook accepts and returns
- **Pattern-Based Filtering**: Target specific hooks using patterns like "use*", "*Auth*", "useState"

### 📄 Smart Page Analysis
- **Next.js Routes**: List all pages and their routing structure
- **Dynamic Routes**: Show dynamic routes and their parameter names
- **Data Fetching**: Find getStaticProps, getServerSideProps, and getStaticPaths usage
- **API Routes**: List all API endpoints and their methods
- **Layout Components**: Show _app.js, _document.js, and layout structure
- **Route Filtering**: Target specific pages using patterns like "api/*", "[slug]", "index"

### 🏗️ Feature & Module Intelligence
- **Module Structure**: Show feature-based organization and folder structure
- **Shared Components**: List reusable components and utilities
- **Context Providers**: Find React Context definitions and usage
- **Business Logic**: Show service layers and utility functions
- **Type Definitions**: List TypeScript interfaces and types
- **Feature Targeting**: Analyze specific features using patterns like "auth", "*admin*", "user*"

### 🎯 Pattern Recognition
- **Architecture Patterns**: Detect HOCs, render props, compound components
- **React Patterns**: Find context patterns, hook patterns, state management
- **Next.js Patterns**: Identify data fetching patterns, routing patterns
- **Custom Pattern Matching**: Target specific patterns with flexible filtering

### 🌍 i18n Translation Analysis
- **Advanced Validator System**: 7 specialized validators for accurate string detection
- **Smart Detection**: JSX text, attributes, component props, variables, object properties, form validation, and alert messages
- **False Positive Prevention**: Whitelist-based approach prevents technical strings from being flagged
- **Project Language Detection**: Automatically detect available languages from directory structure and config files
- **Translation Coverage**: Find strings that need translation wrapping with detailed categorization
- **Missing Translation Keys**: Identify missing keys across language files
- **Translation File Analysis**: Analyze JSON translation files for completeness
- **Multi-Language Support**: Support for complex i18n setups with multiple locales
- **Path Targeting**: Analyze specific directories or files for focused translation work
- **Modular Architecture**: Clean separation of concerns with dedicated validator modules

## 🛠️ Available Tools

The MCP server provides the following tools for analyzing Next.js projects. All tools support multiple output formats and flexible analysis modes.

### **Analysis Modes**
- **`all`** (default): Basic overview/listing of all elements
- **`specific`**: Target specific elements using pattern matching
- **`detailed`**: Comprehensive analysis with full details

### **Output Formats**
All tools support multiple output formats:
- **`text`**: Human-readable format (default)
- **`markdown`**: Structured markdown with headers and lists
- **`json`**: Machine-readable structured data

### `analyze_components`
Comprehensive React component analysis with flexible targeting.

**Parameters:**
```json
{
  "path": "string (optional) - Directory/file path relative to project root",
  "format": "text|markdown|json - Output format (default: text)",
  "mode": "all|specific|detailed - Analysis depth (default: all)",
  "componentPattern": "string - Pattern to match specific components (e.g., 'Button', '*Modal', 'Auth*')",
  "includeProps": "boolean - Include component props information",
  "includeHooks": "boolean - Include hooks usage information"
}
```

**Examples:**
```json
// Get all components overview
{"mode": "all"}

// Find specific Button components  
{"mode": "specific", "componentPattern": "*Button*"}

// Detailed analysis with props and hooks
{"mode": "detailed", "includeProps": true, "includeHooks": true}
```

### `analyze_hooks`
Analyze React hooks usage with smart filtering capabilities.

**Parameters:**
```json
{
  "path": "string (optional) - Directory/file path relative to project root", 
  "format": "text|markdown|json - Output format (default: text)",
  "mode": "all|specific|detailed - Analysis depth (default: all)",
  "hookPattern": "string - Pattern to match specific hooks (e.g., 'useState', 'use*', '*Auth*')",
  "includeBuiltIn": "boolean - Include built-in React hooks (default: true)",
  "includeCustom": "boolean - Include custom hooks (default: true)"
}
```

**Examples:**
```json
// Get all hooks overview
{"mode": "all"}

// Find all custom hooks
{"mode": "specific", "hookPattern": "use*", "includeBuiltIn": false}

// Detailed useState analysis
{"mode": "detailed", "hookPattern": "useState"}
```

### `analyze_pages`
Analyze Next.js pages and routing with pattern-based filtering.

**Parameters:**
```json
{
  "path": "string (optional) - Pages directory path (auto-detects pages/app)",
  "format": "text|markdown|json - Output format (default: text)", 
  "mode": "all|specific|detailed - Analysis depth (default: all)",
  "pagePattern": "string - Pattern to match specific pages (e.g., 'api/*', '[slug]', 'index')",
  "includeApiRoutes": "boolean - Include API routes (default: true)"
}
```

**Examples:**
```json
// Get all pages overview
{"mode": "all"}

// Analyze only API routes
{"mode": "specific", "pagePattern": "api/*"}

// Detailed page analysis
{"mode": "detailed", "includeApiRoutes": true}
```

### `analyze_features`
Analyze project features and module organization.

**Parameters:**
```json
{
  "path": "string (optional) - Source directory path (default: 'src')",
  "format": "text|markdown|json - Output format (default: text)",
  "mode": "all|specific|detailed - Analysis depth (default: all)", 
  "featurePattern": "string - Pattern to match specific features (e.g., 'auth', '*admin*', 'user*')",
  "includeTypes": "boolean - Include TypeScript type information"
}
```

**Examples:**
```json
// Get all features overview
{"mode": "all"}

// Analyze authentication features
{"mode": "specific", "featurePattern": "*auth*"}

// Detailed feature analysis with types
{"mode": "detailed", "includeTypes": true}
```

### `analyze_patterns`
Analyze React and Next.js architectural patterns.

**Parameters:**
```json
{
  "path": "string (optional) - Directory path to analyze",
  "format": "text|markdown|json - Output format (default: text)",
  "mode": "all|specific|detailed - Analysis depth (default: all)",
  "patternType": "hooks|context|hoc|render-props|all - Pattern category (default: all)",
  "patternPattern": "string - Pattern to match specific patterns (e.g., 'withAuth', '*Provider')"
}
```

**Examples:**
```json
// Get all patterns overview
{"mode": "all"}

// Find HOC patterns
{"mode": "specific", "patternType": "hoc"}

// Detailed context pattern analysis
{"mode": "detailed", "patternType": "context"}
```

### `get_project_overview`
Consolidated project state in a single call: framework fingerprint, route summary, and code counts. Delegates to `get_project_fingerprint` + `analyze_routes` internally (no duplication).

**Parameters:**
```json
{
  "format": "text|markdown|json - Output format (default: json)"
}
```

**Returns:** `{ name, version, fingerprint, routes: {total, pages, routeHandlers, apiRoutes, dynamic, server, client}, counts: {components, customHooks} }`

**When to use:** One call when you want everything. For a cheaper first call, use `get_project_fingerprint`.

### `get_help`
Get help information about available commands and usage.

**Parameters:**
```json
{
  "format": "text|markdown|json - Output format (default: text)",
  "command": "string (optional) - Get help for specific command"
}
```

**Returns:** Comprehensive help documentation and usage examples

### `analyze_i18n`
Comprehensive internationalization (i18n) analysis with advanced validator system for accurate translation detection.

**Parameters:**
```json
{
  "path": "string (optional) - Directory or file path to analyze (default: project root)",
  "format": "text|markdown|json - Output format (default: text)",
  "mode": "all|specific|detailed - Analysis depth (default: all)",
  "languages": "string[] (optional) - Specific languages to analyze (auto-detected if not provided)",
  "includeUntranslated": "boolean - Include untranslated strings (default: true)",
  "includeMissing": "boolean - Include missing translation keys (default: true)",
  "filePattern": "string - Pattern to match specific files (e.g., '**/*.tsx', 'src/components/**')"
}
```

**Advanced Validator System:**
- **Validator 1**: JSX Text Content (HIGH) - Direct text in JSX elements
- **Validator 2**: User-facing JSX Attributes (HIGH) - alt, title, placeholder, label attributes
- **Validator 3**: User Message Variables (HIGH) - Variables with semantic names like *Message, *Text, *Label
- **Validator 4**: User-facing Object Properties (MEDIUM) - Object properties like {message: "text", title: "text"}
- **Validator 5**: Form Validation Messages (MEDIUM) - Validation error and success messages
- **Validator 6**: Component Props (MEDIUM) - Props passed to React components (title, message, confirmText, etc.)
- **Validator 7**: Alert Messages (MEDIUM) - User-facing alert(), confirm(), prompt() calls (excludes console.log)

**Smart Detection Features:**
- **Whitelist Approach**: Only flags known user-facing patterns, preventing false positives
- **Component vs HTML Distinction**: Differentiates between component props and HTML attributes
- **Technical String Filtering**: Ignores technical identifiers, CSS classes, API endpoints, debug messages
- **Path Targeting**: Focus analysis on specific directories or files

**Examples:**
```json
// Full project analysis with all validators
{"mode": "all", "format": "json"}

// Analyze specific directory only
{"path": "src/components", "mode": "detailed"}

// Target single file for focused analysis
{"path": "src/pages/dashboard.tsx", "format": "text"}

// Focus on high-priority validators only
{"mode": "specific", "includeUntranslated": true, "format": "markdown"}

// Component-focused analysis
{"path": "src/components", "filePattern": "**/*.tsx", "format": "json"}
```

---

## 🧭 LLM-Oriented Tools

These tools are designed to answer the questions an LLM asks while editing a Next.js project. Each is single-purpose, fast, and returns structured JSON that can be fed into the next call. Together they form a natural workflow:

> `find_symbol("Button")` → file path → `get_component_props` / `get_hook_signature` / `find_references` → imports & call sites → edit with confidence.
>
> To know what a file exposes before writing an import, call `get_file_exports`.

### `get_project_fingerprint`
Fast, no-AST project identification. Intended as the session-opener an LLM calls first to ground itself before any expensive analysis.

**Parameters:**
```json
{ "format": "text|markdown|json - default: json" }
```

**Returns:**
- `framework` — Next.js + React versions, router (`app`/`pages`/`mixed`), TypeScript on/off
- `structure` — src/app/pages/components/lib/public paths, `hasMiddleware`
- `tooling` — package manager, test framework, linter, formatter
- `stack` — styling (tailwind/emotion/…), state (zustand/redux/…), data fetching (react-query/swr/trpc/…), forms, validation, i18n, auth, data layer (prisma/drizzle/…), UI kit (shadcn/radix/mui/…)
- `configFiles` — detected config files
- `versions` — key dependency versions

Completes in milliseconds — pure filesystem inspection, no AST parsing.

---

### `analyze_routes`
Routing graph for the project: URL → file, with rendering mode, data-fetching, dynamic segments, layout chain, and HTTP methods.

**Parameters:**
```json
{
  "path": "string (optional) - Filter routes. Exact match or /prefix/** glob.",
  "format": "text|markdown|json - default: json"
}
```

**Per-route fields:** `path`, `file`, `routerType` (`app`/`pages`), `kind` (`page`/`route-handler`/`api-route`), `rendering` (`server`/`client`/`null`), `dataFetching` (`async-rsc`/`gssp`/`gsp`/`route-handler`/`none`), `dynamicSegments`, `layoutChain` (App Router), `methods` (route handlers).

**App Router specifics:**
- `(group)` / `@slot` segments correctly stripped from URLs
- Intercepting routes `(.)x` skipped from the main graph
- `'use client'` directive → client rendering
- Async default export → `async-rsc` data fetching

**Examples:**
```json
{"path": "/settings/**"}
{"path": "/api/users"}
```

---

### `analyze_imports`
Import graph for a file. Tells you both directions: what this file imports, and who imports this file.

**Parameters:**
```json
{
  "file": "string - project-relative or absolute path",
  "direction": "outgoing|incoming|both - default: both",
  "format": "text|markdown|json - default: json"
}
```

**Returns:**
- `outgoing`: `{ local: [...], external: [...], unresolved: [...] }` — each entry has source, resolved file, specifiers, import kind (`value`/`type`/`dynamic`/`re-export`), line number
- `incoming`: array of importers with their specifiers and line numbers
- Unrequested direction is `null` (consistent response shape for LLMs)

**Resolution handles:** relative paths with auto-extension probing, TS-ESM `./foo.js` → `./foo.ts` on disk, tsconfig `paths` aliases (`@/*`), `index.*` directory resolution, comment-tolerant `tsconfig.json` parsing.

---

### `find_symbol`
Locate declarations by name across the project. The glue between "I know the name" and the tools that need a file path.

**Parameters:**
```json
{
  "name": "string - the identifier (e.g. 'Button', 'useAuth', 'User')",
  "kind": "any|component|hook|function|type|interface|class|variable - default: any",
  "format": "text|markdown|json - default: json"
}
```

**Classification:**
- `useFoo` → `hook`
- PascalCase + body returns JSX → `component`
- Class extending `React.Component` / `PureComponent` → `component`
- Otherwise classified by declaration type

Each match reports `file`, `kind`, `exported`, `default` (default-export), `line`, `column`, and `returnsJsx` when confident.

---

### `find_references`
Find every place in the project that imports and uses a given symbol. Returns flat list of references with file, line, column, and kind — the blast radius of a rename.

**Parameters:**
```json
{
  "symbol": "string - exported name (e.g. 'Button')",
  "file": "string - the file that defines the symbol",
  "format": "text|markdown|json - default: json"
}
```

**Handles:** named imports (including `import { A as B }`), default imports with any local alias, namespace imports (`* as ns` → reports `ns.symbol` member access), re-exports (`export { X } from …`), type-only imports.

**Kinds:** `import`, `call`, `jsx`, `type`, `identifier`.

---

### `get_component_props`
Extract the prop surface of a named React component.

**Parameters:**
```json
{
  "component": "string - component name (e.g. 'Button')",
  "file": "string - file that defines it",
  "format": "text|markdown|json - default: json"
}
```

**Returns:** `{ name, file, found, componentKind: 'function'|'arrow'|'class'|'unknown', propsTypeSource, propsTypeName, propsTypeFile, props: [{ name, type, required }], notes }`

**Supports:**
- Function, arrow, and class components (incl. `extends React.Component<Props>`)
- Inline object types, local interfaces, local type aliases
- One-hop imported types — follows `import type { Props } from '...'` to the target file, reports `propsTypeFile`
- Renamed imports (`import { A as B }`) — reports the exported name
- **Composed types** (1.4+): intersections (`A & B`), interface `extends` chains, utility types (`Omit`, `Pick`, `Partial`, `Required`), and `React.FC<Props>` / `FC<Props>` generics on const declarations. Top-level unnamed composition reports `propsTypeSource: 'composed'`.

**Out of scope (reported with notes, not guessed):** mapped types (`{ [K in keyof T]: U }`), conditional types, multi-hop re-exports, default/namespace imports used as types, `Omit`/`Pick` keys given as type references rather than string-literal unions.

---

### `get_file_exports`
List every top-level export of a file — name, kind, `default` flag, line/column. The question you ask before every import.

**Parameters:**
```json
{
  "file": "string - project-relative or absolute path",
  "format": "text|markdown|json - default: json"
}
```

**Per-export fields:** `name`, `kind` (`component`/`hook`/`function`/`class`/`interface`/`type`/`enum`/`variable`/`re-export`/`re-export-all`/`re-export-ns`/`unknown`), `default`, `line`, `column`. Re-exports include `source` (original module) and `originalName` when renamed.

---

### `get_hook_signature`
Mirror of `get_component_props` for custom hooks. Parameters + explicit return-type annotation.

**Parameters:**
```json
{
  "hook": "string - hook name (e.g. 'useAuth')",
  "file": "string - file that defines it",
  "format": "text|markdown|json - default: json"
}
```

**Returns:** `{ name, file, found, kind: 'function'|'arrow'|'unknown'|null, parameters: [{ name, type, required, destructured?, rest? }], returnType: string|null, notes }`

`returnType` is `null` when the hook's return is inferred rather than explicitly annotated. Destructured params (`{ a, b }: Options`) are surfaced as a single entry named `options` (or `tuple` for array destructuring) with the full annotation as the type and `destructured: true`.

---

## 🎯 Usage Patterns

### **Basic Analysis**
```json
// Get overview of all components
{"tool": "analyze_components", "args": {"mode": "all"}}

// Get overview of all pages
{"tool": "analyze_pages", "args": {"mode": "all"}}

// Get overview of all hooks
{"tool": "analyze_hooks", "args": {"mode": "all"}}
```

### **Targeted Analysis**
```json
// Find specific components
{"tool": "analyze_components", "args": {"mode": "specific", "componentPattern": "Button"}}

// Find API routes only
{"tool": "analyze_pages", "args": {"mode": "specific", "pagePattern": "api/*"}}

// Find custom hooks only
{"tool": "analyze_hooks", "args": {"mode": "specific", "hookPattern": "use*", "includeBuiltIn": false}}
```

### **Comprehensive Analysis**
```json
// Detailed component analysis with props and hooks
{"tool": "analyze_components", "args": {"mode": "detailed", "includeProps": true, "includeHooks": true}}

// Detailed feature analysis with TypeScript types
{"tool": "analyze_features", "args": {"mode": "detailed", "includeTypes": true}}

// Detailed pattern analysis for specific pattern type
{"tool": "analyze_patterns", "args": {"mode": "detailed", "patternType": "context"}}
```

## 🏗️ Architecture

### **Tools Structure**
```
src/tools/
├── types.ts                    # Common tool types and utilities
├── shared/
│   └── module-resolver.ts      # Import resolution shared across tools
├── analyze-components.ts       # React component analysis
├── analyze-hooks.ts            # Hook analysis
├── analyze-pages.ts            # Page analysis (legacy)
├── analyze-features.ts         # Feature analysis
├── analyze-patterns.ts         # Architectural pattern analysis
├── analyze-i18n.ts             # 7-validator i18n analysis
├── analyze-routes.ts           # Routing graph (URL → file, rendering, layout chain)
├── analyze-imports.ts          # Import graph (outgoing + incoming)
├── find-symbol.ts              # Name → file resolution with classification
├── find-references.ts          # Symbol usage sites (blast radius)
├── get-component-props.ts      # Prop-type extraction (supports imported types)
├── project-fingerprint.ts      # Fast no-AST project identification
├── project-overview.ts         # Consolidated view (fingerprint + routes + counts)
├── help.ts                     # Help documentation
└── index.ts                    # Tool registry and execution
```

### **Plugin System**
```
src/plugins/
├── manager.ts                 # Plugin manager
├── registry.ts               # Plugin registration
├── base.ts                   # Base plugin class
├── common/                   # Shared utilities
├── component-extractor/      # Component analysis plugin
├── hook-extractor/          # Hook analysis plugin
├── page-extractor/          # Page analysis plugin
├── feature-extractor/       # Feature analysis plugin
└── pattern-extractor/       # Pattern analysis plugin
```

Each plugin supports the `formatData(data, format)` method for consistent output formatting across all analysis modes.

## 📋 Installation & Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- A Next.js project to analyze

### Installation

```bash
# Clone the repository
git clone https://github.com/devalma/mcp-talk-to-project-next-js.git
cd mcp-talk-to-project-next-js

# Install dependencies
npm install

# Build the server
npm run build
```

## 🚀 Quick Start

### Option 1: Use with Claude Desktop (Recommended)

1. **Clone and setup the MCP server:**
```bash
git clone https://github.com/devalma/mcp-talk-to-project-next-js.git
cd mcp-talk-to-project-next-js
npm install
npm run build
```

2. **Add to Claude Desktop config** (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):
```json
{
  "mcpServers": {
    "nextjs-analyzer": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-talk-to-project-next-js/dist/index.js"],
      "env": {
        "NEXTJS_PROJECT_PATH": "/absolute/path/to/your/nextjs/project"
      }
    }
  }
}
```

3. **Restart Claude Desktop** and start analyzing your Next.js projects!

### Option 2: Use with npx (Now Available!)

```bash
# Use npx to run without installation
npx mcp-talk-to-project-next-js /path/to/your/nextjs/project
```

### Option 3: Standalone CLI Usage

Test the analyzer directly from command line with support for path targeting:

```bash
# Analyze entire project
export NEXTJS_PROJECT_PATH="/path/to/your/nextjs/project"
npm run cli analyze components

# Analyze specific directory
node cli.js /path/to/project/src/components i18n --format=json

# Analyze single file  
node cli.js /path/to/project/src/pages/dashboard.tsx i18n --format=text

# Focus on specific areas
node cli.js /path/to/project/src/features/auth i18n --path=components

# Use the demo project for testing
npm run test
node cli.js demo-project i18n --format=json
```

### Testing

Test the server with the included demo project:

```bash
# Run with demo project
npm run test

# Use CLI for testing
npm run cli analyze components

# Start development server
npm run dev
```

### Configuration

Add the MCP server to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "nextjs-analyzer": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-talk-to-project-next-js/dist/index.js"],
      "env": {
        "NEXTJS_PROJECT_PATH": "/absolute/path/to/your/nextjs/project"
      }
    }
  }
}
```

**Configuration Options:**
- `NEXTJS_PROJECT_PATH`: (Required) Absolute path to the Next.js project to analyze
- `CACHE_ENABLED`: (Optional) Enable AST caching for better performance (default: true)
- `MAX_FILE_SIZE`: (Optional) Maximum file size to parse in bytes (default: 1MB)

### Configuration Examples

**Example 1: Local installation (recommended for now)**
```json
{
  "mcpServers": {
    "nextjs-analyzer": {
      "command": "node",
      "args": ["/Users/you/tools/mcp-talk-to-project-next-js/dist/index.js"],
      "env": {
        "NEXTJS_PROJECT_PATH": "/Users/you/projects/my-nextjs-app"
      }
    }
  }
}
```

**Example 2: Multiple projects (local installation)**
```json
{
  "mcpServers": {
    "nextjs-analyzer-project1": {
      "command": "node",
      "args": ["/Users/you/tools/mcp-talk-to-project-next-js/dist/index.js"],
      "env": {
        "NEXTJS_PROJECT_PATH": "/Users/you/projects/ecommerce-app"
      }
    },
    "nextjs-analyzer-project2": {
      "command": "node", 
      "args": ["/Users/you/tools/mcp-talk-to-project-next-js/dist/index.js"],
      "env": {
        "NEXTJS_PROJECT_PATH": "/Users/you/projects/blog-app"
      }
    }
  }
}
```

**Example 3: Using with npm (development)**
```json
{
  "mcpServers": {
    "nextjs-analyzer-dev": {
      "command": "npm",
      "args": ["run", "start"],
      "cwd": "/Users/you/tools/mcp-talk-to-project-next-js",
      "env": {
        "NEXTJS_PROJECT_PATH": "/Users/you/projects/current-project"
      }
    }
  }
}
```

**Example 4: Using with npx (now available)**
```json
{
  "mcpServers": {
    "nextjs-analyzer": {
      "command": "npx",
      "args": ["mcp-talk-to-project-next-js"],
      "env": {
        "NEXTJS_PROJECT_PATH": "/Users/you/projects/my-nextjs-app"
      }
    }
  }
}
```

## 🎯 Usage Examples

### Getting Component Information
**Query:** "What React components are in this project?"
*Uses: `analyze_components` to scan the entire project*

**Example Response:**
```json
{
  "components": [
    {
      "name": "Button",
      "type": "functional",
      "file": "src/components/ui/Button.tsx",
      "props": ["children", "onClick", "variant", "disabled"],
      "hooks": ["useState"],
      "exports": "default",
      "category": "shared"
    },
    {
      "name": "LoginForm",
      "type": "functional", 
      "file": "src/features/auth/components/LoginForm.jsx",
      "props": ["onSubmit", "loading"],
      "hooks": ["useForm", "useState"],
      "exports": "default",
      "category": "feature"
    }
  ]
}
```

### Finding Hook Information
**Query:** "Show me all custom hooks and their signatures"
*Uses: `analyze_hooks` with includeCustom: true*

**Example Response:**
```json
{
  "customHooks": [
    {
      "name": "useLocalStorage",
      "file": "src/hooks/useLocalStorage.ts",
      "parameters": ["key", "initialValue"],
      "returns": ["storedValue", "setValue"],
      "dependencies": ["useState", "useEffect"]
    },
    {
      "name": "useAuth",
      "file": "src/hooks/useAuth.js",
      "parameters": [],
      "returns": ["user", "login", "logout", "loading"],
      "dependencies": ["useContext", "useState", "useEffect"]
    }
  ]
}
```

### Understanding Page Structure
**Query:** "What pages does this Next.js app have and how are they organized?"
*Uses: `analyze_pages` to show the routing structure*

**Example Response:**
```json
{
  "pages": [
    {
      "route": "/",
      "file": "pages/index.js",
      "component": "HomePage",
      "dataFetching": ["getStaticProps"]
    },
    {
      "route": "/blog/[slug]",
      "file": "pages/blog/[slug].tsx",
      "component": "BlogPost",
      "dataFetching": ["getStaticProps", "getStaticPaths"],
      "dynamicParams": ["slug"]
    },
    {
      "route": "/api/users",
      "file": "pages/api/users.js",
      "type": "api",
      "methods": ["GET", "POST"]
    }
  ]
}
```

### Project Overview
**Query:** "Give me an overview of this Next.js project's structure"
*Uses: `get_project_overview` for comprehensive project information*

**Example Response:**
```json
{
  "projectInfo": {
    "name": "my-nextjs-app",
    "version": "1.0.0",
    "nextVersion": "13.4.0",
    "structure": "app",
    "typescript": true,
    "componentCount": 15,
    "pageCount": 8,
    "apiRouteCount": 4,
    "customHookCount": 3,
    "features": ["authentication", "blog", "dashboard"],
    "dependencies": ["next", "react", "typescript", "tailwindcss"]
  }
}
```

### Feature Analysis
**Query:** "What features are organized in my src folder?"
*Uses: `analyze_features` with default srcDir: "src"*

**Example Response:**
```json
{
  "features": [
    {
      "name": "authentication",
      "path": "src/features/auth",
      "components": [
        {
          "name": "LoginForm",
          "file": "src/features/auth/components/LoginForm.tsx"
        },
        {
          "name": "SignupForm", 
          "file": "src/features/auth/components/SignupForm.tsx"
        },
        {
          "name": "UserProfile",
          "file": "src/features/auth/components/UserProfile.tsx"
        }
      ],
      "hooks": ["useAuth", "useLogin"],
      "types": ["User", "AuthState"],
      "services": ["authService", "tokenService"]
    },
    {
      "name": "blog",
      "path": "src/features/blog", 
      "components": [
        {
          "name": "BlogPost",
          "file": "src/features/blog/components/BlogPost.tsx"
        },
        {
          "name": "BlogList",
          "file": "src/features/blog/components/BlogList.tsx"
        },
        {
          "name": "BlogEditor",
          "file": "src/features/blog/components/BlogEditor.tsx"
        }
      ],
      "hooks": ["useBlog", "useComments"],
      "types": ["Post", "Comment"],
      "services": ["blogService"]
    }
  ],
  "sharedComponents": {
    "path": "src/components",
    "components": [
      {
        "name": "Button",
        "file": "src/components/ui/Button.tsx"
      },
      {
        "name": "Modal",
        "file": "src/components/ui/Modal.tsx"
      },
      {
        "name": "Layout",
        "file": "src/components/layout/Layout.tsx"
      }
    ]
  }
}
```

### Specific Component Details
**Query:** "Tell me about the LoginForm component - what props does it accept?"
*Uses: `analyze_components` with path "features/auth/components/LoginForm.tsx", includeProps: true*

**Example Response:**
```json
{
  "component": {
    "name": "LoginForm",
    "file": "src/features/auth/components/LoginForm.tsx",
    "category": "feature",
    "feature": "authentication",
    "props": {
      "onSubmit": {
        "type": "(credentials: LoginCredentials) => Promise<void>",
        "required": true,
        "description": "Callback function when form is submitted"
      },
      "loading": {
        "type": "boolean",
        "required": false,
        "default": "false",
        "description": "Shows loading state during authentication"
      },
      "initialEmail": {
        "type": "string",
        "required": false,
        "description": "Pre-populate email field"
      }
    },
    "hooks": ["useForm", "useState"],
    "imports": ["Button", "Input", "useAuth"]
  }
}
```

## 🔧 Supported File Types

- **JavaScript**: `.js`, `.jsx`
- **TypeScript**: `.ts`, `.tsx`
- **Next.js Specific**: `pages/`, `app/`, API routes
- **Configuration**: `next.config.js`, `package.json`

## 🏛️ Architecture

```
src/
├── index.ts              # MCP server entry point
├── tools/                # MCP tools implementation
│   ├── analyze-components.ts    # Component analysis tool
│   ├── analyze-hooks.ts         # Hook analysis tool
│   ├── analyze-pages.ts         # Page analysis tool
│   ├── analyze-features.ts      # Feature analysis tool
│   ├── analyze-patterns.ts      # Pattern analysis tool
│   ├── project-overview.ts      # Project overview tool
│   ├── help.ts                  # Help documentation tool
│   └── index.ts                 # Tool registry
├── plugins/              # Analysis plugins
│   ├── manager.ts               # Plugin manager
│   ├── registry.ts              # Plugin registration
│   ├── base.ts                  # Base plugin class
│   ├── common/                  # Shared utilities
│   ├── component-extractor/     # Component analysis plugin
│   ├── hook-extractor/          # Hook analysis plugin
│   ├── page-extractor/          # Page analysis plugin
│   ├── feature-extractor/       # Feature analysis plugin
│   └── pattern-extractor/       # Pattern analysis plugin
├── resources/            # MCP resources
│   ├── handlers.ts              # Resource handlers
│   ├── registry.ts              # Resource registration
│   └── types.ts                 # Resource types
├── parsers/
│   └── ast.ts                   # AST parsing utilities
├── utils/
│   └── file.ts                  # File system utilities
└── types/
    ├── info.ts                  # Information result types
    └── plugin.ts                # Plugin types
```

## 🚦 Performance

- **AST Caching**: Parsed ASTs are cached to avoid re-parsing unchanged files
- **Selective Scanning**: Only scans requested directories or files
- **Memory Management**: Efficient memory usage for large codebases
- **Fast Retrieval**: Quick information extraction from cached ASTs
- **Plugin Architecture**: Modular design for extensibility

## 🔍 Information Capabilities

### Component Information
- Component type (functional/class)
- Props interface and types
- State usage presence
- Lifecycle methods (class components)
- Hook usage list
- JSX structure overview

### Hook Information  
- Hook definitions and signatures
- Dependencies and parameters
- Custom hook composition
- Built-in hook usage locations
- Hook return types

### Page Information
- Static vs dynamic routes
- Data fetching methods present
- Page components and their props
- API route endpoints and methods
- Layout component usage

### Feature Information
- Module boundaries and structure
- Shared component locations
- Business logic organization
- Utility function locations
- Type definition locations

### Pattern Analysis
- React patterns (Context, HOCs, Render Props)
- Next.js patterns (Data fetching, Routing)
- Architecture patterns identification

## 🐛 Troubleshooting

### Common Issues

**Server not connecting:**
- Verify Node.js version (18+)
- Check that the build completed successfully
- Ensure correct path in MCP configuration

**Information not available:**
- Verify the project is a valid Next.js project
- Check file permissions
- Ensure TypeScript files can be parsed

**Performance issues:**
- Large projects may take time on first scan
- Clear cache if experiencing memory issues
- Consider scanning specific directories instead of entire project

**npx now available:**
- Package successfully published to npm
- Use `npx mcp-talk-to-project-next-js` to run without installation
- For development or customization, use the local installation method
- On first run, npx may take time to download and cache the package
- Use `npx --verbose mcp-talk-to-project-next-js` for debugging

### Debug Mode

Run with debug logging:
```bash
DEBUG=mcp:nextjs npm run start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📝 License

MIT License - see [LICENSE](LICENSE) for details

## 🔗 Related Projects

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Next.js](https://nextjs.org/)
- [Babel Parser](https://babeljs.io/docs/en/babel-parser)

## 📞 Support

- [GitHub Issues](https://github.com/devalma/mcp-talk-to-project-next-js/issues)
- [MCP Documentation](https://modelcontextprotocol.io/docs)
- [Next.js Documentation](https://nextjs.org/docs)
