# Next.js Project Analyzer MCP Server

A Model Context Protocol (MCP) server that provides comprehensive analysis of Next.js projects using Abstract Syntax Tree (AST) parsing. This server enables AI assistants to understand Next.js codebases by extracting detailed information about components, hooks, pages, features, and architectural patterns with flexible analysis modes.

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
Provides comprehensive information about the entire Next.js project.

**Parameters:**
```json
{
  "format": "text|markdown|json - Output format (default: text)"
}
```

**Returns:** Complete project structure, technology stack, configuration, and statistics

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
├── analyze-components.ts       # Component analysis tool
├── analyze-hooks.ts           # Hook analysis tool  
├── analyze-pages.ts           # Page analysis tool
├── analyze-features.ts        # Feature analysis tool
├── analyze-patterns.ts        # Pattern analysis tool
├── project-overview.ts        # Project overview tool
├── help.ts                    # Help documentation tool
└── index.ts                   # Tool registry and execution
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

### Option 2: Use with npx (Coming Soon)

**Note:** This option will be available once the package is published to npm.

```bash
# Will be available after npm publish
npx mcp-talk-to-project-next-js /path/to/your/nextjs/project
```

### Option 3: Standalone CLI Usage

Test the analyzer directly from command line:

```bash
# Analyze your project
export NEXTJS_PROJECT_PATH="/path/to/your/nextjs/project"
npm run cli analyze components

# Or use the demo project
npm run test
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

**Example 4: Using with npx (after npm publish)**
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

**npx issues:**
- **Package not published yet**: The npm package is not yet published, so npx won't work until after `npm publish`
- For now, use the local installation method (clone the repository)
- After publishing to npm, ensure you have npm/Node.js 18+ installed
- If npx fails after publishing, try `npm install -g mcp-talk-to-project-next-js` first
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
