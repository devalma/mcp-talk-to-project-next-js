# Getting Started

Three things to do: install, point the server at your project, register it with your MCP client.

## Install

### Via npx (recommended — no global install)

```bash
npx mcp-talk-to-project-next-js /path/to/your/nextjs/project
```

First run downloads and caches the package. Subsequent invocations are instant.

### Global install

```bash
npm install -g mcp-talk-to-project-next-js
```

Then the binary `mcp-talk-to-project-next-js` (MCP server) and `nextjs-i18n` (CLI) are on your PATH.

### From source (for development)

```bash
git clone https://github.com/devalma/mcp-talk-to-project-next-js.git
cd mcp-talk-to-project-next-js
npm install
npm run build
npm test  # should report 291 passing
```

Requires Node 20.19+ (vitest 4 engine constraint — see [next-steps.md](next-steps.md) for the lockfile story).

## Point it at your project

Two ways:

1. **Env var (preferred for MCP clients):** `NEXTJS_PROJECT_PATH=/absolute/path/to/project`
2. **Argv (for one-off CLI runs):** `npx mcp-talk-to-project-next-js /absolute/path/to/project`

If neither is set, the server uses the current working directory.

Additional env vars:

| Variable | Default | Effect |
|---|---|---|
| `NEXTJS_PROJECT_PATH` | `$PWD` | Absolute path to the project to analyze |
| `MCP_DEBUG` | `false` | Set to `true` for verbose plugin-level logging |

## Register with an MCP client

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

Restart Claude Desktop. Ask "What tools do you have?" to verify the 16 tools show up.

### Cursor / VS Code / Claude Code CLI

All three read an `mcp` section in their settings. The shape is the same as above — `command`, `args`, `env`. In Claude Code CLI:

```bash
claude mcp add nextjs-analyzer npx -- mcp-talk-to-project-next-js
# then set NEXTJS_PROJECT_PATH in the generated config file
```

### Multiple projects

Define one `mcpServers` entry per project, each with its own `NEXTJS_PROJECT_PATH`:

```json
{
  "mcpServers": {
    "acme-web": { "command": "npx", "args": ["mcp-talk-to-project-next-js"], "env": { "NEXTJS_PROJECT_PATH": "/repos/acme-web" } },
    "acme-admin": { "command": "npx", "args": ["mcp-talk-to-project-next-js"], "env": { "NEXTJS_PROJECT_PATH": "/repos/acme-admin" } }
  }
}
```

## First workflow

Try this in your MCP client:

1. *"Run `get_project_fingerprint`"* — framework, router, stack, all detected in ms.
2. *"Find the `Button` component"* — calls `find_symbol`, reports the file.
3. *"Show me Button's props"* — calls `get_component_props`, returns the prop list.

See [tools.md](tools.md) for every tool's parameters.

## CLI-only usage

The `nextjs-i18n` binary runs the i18n analyzer without the MCP server:

```bash
nextjs-i18n /path/to/project i18n --format=json
nextjs-i18n /path/to/project/src/components i18n --format=text
nextjs-i18n /path/to/project/src/pages/dashboard.tsx i18n
nextjs-i18n --help
```

Useful for CI pipelines or as a drop-in `pre-commit` check.

## Troubleshooting

### Server doesn't appear in the MCP client

- Path in the config must be absolute.
- On macOS, restart the client after editing the config — it only reads on launch.
- Run `npx mcp-talk-to-project-next-js` in a terminal first to confirm the package installs cleanly.

### Tools return empty results

- Check that the project at `NEXTJS_PROJECT_PATH` is actually a Next.js project (has `next` in `package.json` dependencies).
- Tools like `analyze_routes` need an `app/` or `pages/` directory — confirm one exists.
- If `find_symbol` can't find something that exists: double-check casing (the scanner is case-sensitive on Linux CI even if your local dev machine is case-insensitive).

### "Failed to parse" notes in output

- The Babel parser couldn't read the file. Usually a stage-4 TC39 proposal the parser plugins list doesn't cover (decorators are on, but exotic patterns may not be).
- Report it as an issue with a minimal reproducer.

### Performance

- First scan of a large repo takes a few seconds. Subsequent calls reuse warm plugin state within a session.
- Prefer scoped calls (`path` parameter on analyze tools; specific file on LLM tools) for tight loops.

## Debug mode

```bash
MCP_DEBUG=true npx mcp-talk-to-project-next-js /path/to/project
```

Emits plugin-level logs to stderr. Useful when a tool reports "0 results" and you want to see which files the scanner rejected.

## Where to go next

- **Every tool's parameters and returns:** [tools.md](tools.md)
- **How the i18n analyzer decides what to flag:** [i18n.md](i18n.md)
- **Writing your own plugin:** [plugin-development.md](plugin-development.md)
- **Utility layer (FileUtils, ASTUtils, caching):** [common-utilities.md](common-utilities.md)
- **Known limitations and future work:** [next-steps.md](next-steps.md)
