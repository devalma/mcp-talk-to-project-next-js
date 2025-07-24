# Getting Started with Next.js Project Analyzer

Quick start guide to get the enhanced MCP server running for comprehensive Next.js project analysis with flexible modes and pattern matching.

## 📋 Prerequisites

- **Node.js** 18+ 
- **npm** or **yarn**
- **TypeScript** knowledge (optional but helpful)
- A **Next.js project** to analyze
- **Claude Desktop** or MCP-compatible client

## ⚡ Quick Installation

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd mcp-talk-to-project-next-js

# Install dependencies
npm install

# Build the project
npm run build
```

### 2. Verify Installation

```bash
# Test the demo project
node demo.js

# Test with your project
export NEXTJS_PROJECT_PATH="/path/to/your/nextjs/project"
node test.js
```

## 🚀 Usage Options

### Option 1: MCP Server (Recommended)

Configure with Claude Desktop for interactive analysis:

1. **Configure Claude Desktop**
   ```json
   {
     "mcpServers": {
       "nextjs-analyzer": {
         "command": "node",
         "args": ["/path/to/mcp-talk-to-project-next-js/dist/index.js", "/path/to/your/nextjs/project"],
         "env": {}
       }
     }
   }
   ```

2. **Start analyzing with Claude**
   - "Analyze all components in this project"
   - "Find components matching '*Button*'"
   - "Show detailed hook analysis"
   - "Get project overview in markdown format"

### Option 2: Command Line Interface

Quick analysis from terminal:

```bash
# Basic component analysis
node dist/index.js /path/to/project

## 🎯 Enhanced Analysis Capabilities

The analyzer now supports **three flexible analysis modes** for comprehensive project understanding:

### **Mode: "all" (Quick Overview)**
Perfect for initial project exploration and getting familiar with the codebase.

**Claude Examples:**
- "Show me all components in this project"
- "What pages does this Next.js app have?"
- "List all the hooks used in this project"

### **Mode: "specific" (Targeted Analysis)**
Use pattern matching to find specific elements you're looking for.

**Claude Examples:**
- "Find all Button components" (uses pattern: "*Button*")
- "Show me API routes only" (uses pattern: "api/*")
- "Find authentication-related features" (uses pattern: "*auth*")

### **Mode: "detailed" (Comprehensive Analysis)**
Get in-depth analysis with full details, dependencies, and insights.

**Claude Examples:**
- "Analyze components in detail with props and hooks"
- "Give me detailed feature analysis with TypeScript types"
- "Show comprehensive page analysis with data fetching methods"

## � Available Analysis Tools

### **🧩 Component Analysis**
```
Tool: analyze_components
Supports: Pattern matching, props analysis, hooks usage
Examples: "Button", "*Modal*", "Auth*"
```

### **🎣 Hook Analysis**
```
Tool: analyze_hooks
Supports: Custom/built-in filtering, dependency analysis
Examples: "use*", "useState", "*Auth*"
```

### **📄 Page Analysis**
```
Tool: analyze_pages
Supports: Route analysis, API endpoints, dynamic routes
Examples: "api/*", "[slug]", "blog/**"
```

### **🏗️ Feature Analysis**
```
Tool: analyze_features
Supports: Module organization, TypeScript integration
Examples: "auth", "*admin*", "user*"
```

### **🎨 Pattern Analysis**
```
Tool: analyze_patterns
Supports: React patterns, architectural insights
Types: hooks, context, hoc, render-props
```

### **📊 Project Overview**
```
Tool: get_project_overview
Provides: Complete project statistics and structure
```

## 🎨 Output Formats

All tools support multiple output formats:

- **`text`**: Human-readable format (default)
- **`markdown`**: Structured markdown for documentation
- **`json`**: Machine-readable structured data

**Claude Examples:**
- "Analyze components and format as markdown"
- "Get project overview in JSON format"
- "Show hook analysis in plain text"

```bash
npm run cli analyze-dependencies /path/to/project
```

**Output includes:**
- External dependencies usage
- Internal module relationships
- Circular dependency detection
- Unused imports/exports

### Hooks Analysis

Deep dive into React hooks usage:

```bash
npm run cli analyze-hooks /path/to/project
```

**Output includes:**
- Built-in hooks usage patterns
- Custom hooks identification
- Hook complexity and best practices
- Performance implications

## 🎯 MCP Tools Reference

When using as an MCP server, these tools are available:

| Tool | Description | Parameters |
|------|-------------|------------|
| `analyze_components` | Extract React component info | `projectPath`, `targetPath?` |
| `analyze_hooks` | Analyze React hooks usage | `projectPath`, `targetPath?` |
| `analyze_pages` | Analyze Next.js pages | `projectPath`, `targetPath?` |
| `analyze_dependencies` | Map import/export relationships | `projectPath`, `targetPath?` |
| `get_project_summary` | Generate project overview | `projectPath` |
| `analyze_file` | Detailed single file analysis | `filePath` |
| `search_code` | Search for patterns in codebase | `projectPath`, `pattern` |
| `get_metrics` | Calculate code quality metrics | `projectPath`, `targetPath?` |

## 🔧 Configuration

### CLI Configuration

Create a `.mcp-config.json` file in your project root:

```json
{
  "plugins": {
    "component-extractor": {
      "enabled": true,
      "includeTests": false,
      "maxComplexity": 10
    },
    "hooks-analyzer": {
      "enabled": true,
      "trackCustomHooks": true
    }
  },
  "output": {
    "format": "json",
    "pretty": true
  },
  "patterns": {
    "include": ["src/**/*.{ts,tsx,js,jsx}"],
    "exclude": ["**/*.test.*", "**/*.stories.*"]
  }
}
```

### Environment Variables

```bash
# Logging level
export MCP_LOG_LEVEL=info

# Cache directory
export MCP_CACHE_DIR=/tmp/mcp-cache

# Max file size for analysis (bytes)
export MCP_MAX_FILE_SIZE=1048576
```

## 📁 Supported Project Structures

### Next.js Projects

```
my-nextjs-app/
├── pages/              # Pages routing
├── components/         # Reusable components  
├── hooks/             # Custom hooks
├── lib/               # Utility libraries
├── styles/            # CSS/styling
└── public/            # Static assets
```

### Create React App

```
my-react-app/
├── src/
│   ├── components/    # React components
│   ├── hooks/         # Custom hooks
│   ├── pages/         # Page components
│   ├── utils/         # Utilities
│   └── App.tsx        # Main app
└── public/
```

### Custom React Projects

```
my-custom-app/
├── src/
│   ├── features/      # Feature-based organization
│   │   ├── auth/
│   │   ├── dashboard/
│   │   └── shared/
│   ├── shared/        # Shared components
│   └── types/         # TypeScript types
```

## 📊 Example Output

### Component Analysis Result

```json
{
  "success": true,
  "data": {
    "components": [
      {
        "name": "UserProfile",
        "filePath": "/src/components/UserProfile.tsx",
        "type": "functional",
        "props": [
          {
            "name": "user",
            "type": "User",
            "required": true
          },
          {
            "name": "showEmail",
            "type": "boolean",
            "required": false,
            "defaultValue": "false"
          }
        ],
        "hooks": [
          {
            "name": "useState",
            "type": "builtin",
            "usageCount": 2
          },
          {
            "name": "useUserData",
            "type": "custom",
            "usageCount": 1
          }
        ],
        "complexity": 4,
        "linesOfCode": 67,
        "exports": {
          "default": true,
          "named": []
        }
      }
    ],
    "summary": {
      "totalComponents": 1,
      "functionalComponents": 1,
      "classComponents": 0,
      "averageComplexity": 4,
      "hooksUsage": {
        "useState": 2,
        "useEffect": 1,
        "useUserData": 1
      }
    }
  },
  "metadata": {
    "processingTime": 156,
    "filesProcessed": 1,
    "pluginVersion": "1.0.0"
  }
}
```

## ⚠️ Troubleshooting

### Common Issues

**Parse Errors**
```bash
# Issue: TypeScript parse errors
# Solution: Ensure you have TypeScript types installed
npm install --save-dev @types/react @types/node
```

**Memory Issues**
```bash
# Issue: Out of memory on large projects
# Solution: Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run cli analyze-components /large/project
```

**Permission Errors**
```bash
# Issue: Cannot read files
# Solution: Check file permissions
chmod -R 755 /path/to/project
```

### Debug Mode

Enable debug logging for troubleshooting:

```bash
# Debug mode
export DEBUG=mcp:*
npm run cli analyze-components /path/to/project

# Verbose output
npm run cli analyze-components /path/to/project --verbose
```

### Performance Tips

1. **Use target paths** to limit analysis scope:
   ```bash
   npm run cli analyze-components /project/path src/components
   ```

2. **Exclude unnecessary files** with patterns:
   ```bash
   npm run cli analyze-components /project --exclude "**/*.test.*" "**/*.stories.*"
   ```

3. **Enable caching** for repeated analysis:
   ```bash
   export MCP_CACHE_ENABLED=true
   npm run cli analyze-components /project
   ```

## 🔗 Next Steps

1. **Explore the CLI**: Try different analysis commands on your projects
2. **Set up MCP Server**: Integrate with your AI assistant
3. **Create Custom Plugins**: Extend functionality for your specific needs
4. **Read the Docs**: Check out the detailed documentation for advanced features

### Useful Links

- [Plugin Development Guide](./plugin-development.md)
- [Common Utilities Documentation](./common-utilities.md)
- [API Reference](./api-reference.md)
- [Examples and Use Cases](./examples/)

## 💬 Support

- **Issues**: Report bugs and feature requests on GitHub
- **Discussions**: Join the community discussions
- **Documentation**: Check the docs directory for detailed guides

Happy analyzing! 🚀
