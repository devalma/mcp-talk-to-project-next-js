# Next.js Project Analyzer — MCP Server

[![npm version](https://badge.fury.io/js/mcp-talk-to-project-next-js.svg)](https://badge.fury.io/js/mcp-talk-to-project-next-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol server that lets an AI assistant understand a Next.js codebase. AST-based, fast, read-only. Answers the questions an LLM asks while editing: *what does this file expose? what are this component's props? what would break if I renamed this symbol?*

## Install

```bash
npm install -g mcp-talk-to-project-next-js
```

Or use it without installing via `npx mcp-talk-to-project-next-js`.

## Claude Desktop

Add to your MCP config:

```json
{
  "mcpServers": {
    "nextjs-analyzer": {
      "command": "npx",
      "args": ["mcp-talk-to-project-next-js"],
      "env": {
        "NEXTJS_PROJECT_PATH": "/absolute/path/to/your/nextjs/project"
      }
    }
  }
}
```

More config options (VS Code, Cursor, other clients) live in [docs/getting-started.md](docs/getting-started.md).

## The core workflow

Sixteen tools, grouped into two layers. Most of the time you want the LLM-oriented layer:

> `get_project_fingerprint` — ground yourself (stack, router, tooling) in milliseconds.
>
> `find_symbol("Button")` — where is it declared?
>
> `get_component_props` / `get_hook_signature` — what's its shape?
>
> `find_references` — who uses it? (blast radius of a rename)
>
> `get_file_exports` / `analyze_imports` — what does a module expose / pull in?
>
> `analyze_routes` — URL → file → rendering mode → data fetching.

The older `analyze_components` / `analyze_hooks` / `analyze_pages` / `analyze_features` / `analyze_patterns` / `analyze_i18n` tools cover broad overviews with `all` / `specific` / `detailed` modes.

**Full tool reference:** [docs/tools.md](docs/tools.md).

## Example

Find every place the `Button` component is used, then look up its props:

```json
{"tool": "find_symbol", "args": {"name": "Button"}}
// → { matches: [{ file: "src/components/Button.tsx", ... }] }

{"tool": "get_component_props", "args": {
  "component": "Button",
  "file": "src/components/Button.tsx"
}}
// → { props: [{ name: "label", type: "string", required: true }, ...] }

{"tool": "find_references", "args": {
  "symbol": "Button",
  "file": "src/components/Button.tsx"
}}
// → 42 references across 18 files
```

## Docs

- **[docs/getting-started.md](docs/getting-started.md)** — install variants, Claude/Cursor/VS Code config, troubleshooting
- **[docs/tools.md](docs/tools.md)** — every tool's parameters and return shape
- **[docs/i18n.md](docs/i18n.md)** — what the 7-validator i18n system detects
- **[docs/plugin-development.md](docs/plugin-development.md)** — writing a new plugin
- **[docs/common-utilities.md](docs/common-utilities.md)** — utility layer (FileUtils, ASTUtils, caching)
- **[docs/next-steps.md](docs/next-steps.md)** — known limitations and ranked future work

## CLI

This package also exposes a standalone CLI for running i18n analysis without the MCP server:

```bash
nextjs-i18n /path/to/project i18n --format=json
nextjs-i18n /path/to/project/src/components i18n
nextjs-i18n --help
```

## Develop

```bash
git clone https://github.com/devalma/mcp-talk-to-project-next-js.git
cd mcp-talk-to-project-next-js
npm install
npm run build
npm test
```

Requires Node 20.19+ (vitest 4 constraint).

## License

MIT — see [LICENSE](LICENSE).

## Links

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [GitHub Issues](https://github.com/devalma/mcp-talk-to-project-next-js/issues)
