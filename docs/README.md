# Next.js Project Analyzer Documentation

This is an enhanced Model Context Protocol (MCP) server that provides comprehensive Next.js project analysis with flexible analysis modes, pattern matching, and multiple output formats. The server uses a sophisticated plugin architecture to deliver deep insights into React components, hooks, pages, features, and architectural patterns.

## 📋 Table of Contents

- [Enhanced Overview](#enhanced-overview)
- [Enhanced Architecture](#enhanced-architecture)
- [Getting Started](./getting-started.md)
- [Quick Reference](./quick-reference.md)
- [API Reference](./api-reference.md)
- [Plugin Development](./plugin-development.md)
- [Common Utilities](./common-utilities.md)
- [Available Plugins](./plugins/)

## 🎯 Enhanced Overview

The Next.js Project Analyzer provides AI assistants with comprehensive project understanding through:

### **🎯 Flexible Analysis Modes**
- **All Mode**: Quick overviews and basic listings
- **Specific Mode**: Targeted analysis with pattern matching
- **Detailed Mode**: Comprehensive analysis with full insights

### **🔍 Smart Pattern Matching**
- Glob-style patterns for flexible element targeting
- Support for wildcards, exact matches, and complex patterns
- Works across components, pages, hooks, features, and patterns

### **📄 Multiple Output Formats**
- **Text**: Human-readable format for quick consumption
- **Markdown**: Structured format for documentation
- **JSON**: Machine-readable format for programmatic use

### **🔧 Comprehensive Analysis Tools**
- **Component Analysis**: Props, hooks, dependencies, complexity metrics
- **Hook Analysis**: Custom/built-in filtering, usage patterns, dependencies
- **Page Analysis**: Routes, dynamic parameters, API endpoints, data fetching
- **Feature Analysis**: Module organization, TypeScript integration, architecture
- **Pattern Analysis**: React patterns, architectural insights, best practices
- **Project Overview**: Statistics, dependencies, technology stack

## 🏗️ Enhanced Architecture

### **Enhanced Plugin System**

The server uses a modular plugin architecture with enhanced formatting capabilities:

```
src/
├── tools/                   # MCP Tools (New Enhanced Structure)
│   ├── types.ts            # Common tool types and utilities
│   ├── analyze-components.ts # Component analysis tool
│   ├── analyze-hooks.ts    # Hook analysis tool
│   ├── analyze-pages.ts    # Page analysis tool
│   ├── analyze-features.ts # Feature analysis tool
│   ├── analyze-patterns.ts # Pattern analysis tool
│   ├── project-overview.ts # Project overview tool
│   ├── help.ts            # Help and documentation
│   └── index.ts           # Tool registry and execution
│
├── plugins/                # Analysis Plugins (Enhanced)
│   ├── common/            # Shared utilities for all plugins
│   │   ├── base.ts       # Enhanced base plugin with formatData
│   │   ├── file-utils.ts # File system operations
│   │   ├── ast-utils.ts  # AST parsing and traversal
│   │   ├── pattern-utils.ts # Pattern matching utilities
│   │   ├── cache-utils.ts # Caching mechanisms
│   │   └── logger.ts     # Logging utilities
│   │
│   ├── component-extractor/ # React component analysis
│   │   ├── extractor.ts     # Component extraction logic
│   │   ├── formatter.ts     # Enhanced multi-format output
│   │   ├── processor.ts     # Component processing
│   │   ├── types.ts        # Component-specific types
│   │   └── index.ts        # Plugin entry point
│   │
│   ├── hook-extractor/      # React hooks analysis
│   ├── page-extractor/      # Next.js pages analysis
│   ├── feature-extractor/   # Feature and module analysis
│   ├── pattern-extractor/   # Architectural pattern detection
│   └── manager.ts          # Plugin management and execution
│
├── types/                  # TypeScript interfaces
├── parsers/               # AST parsing utilities
├── utils/                 # Common utilities
└── index.ts              # Main MCP server
```

### **Key Architectural Enhancements**

#### **1. Enhanced Tool Layer**
- Centralized tool registry with `getAllTools()` and `executeTool()`
- Consistent error handling and response formatting
- Support for all three analysis modes and output formats

#### **2. Enhanced Plugin System**
- All plugins implement `formatData(data, format)` method
- Consistent interface for text, markdown, and JSON output
- Base plugin class enforces formatting standards

#### **3. Pattern Matching Engine**
- Glob-style pattern support across all tools
- Flexible targeting of specific elements
- Efficient filtering during analysis process

#### **4. Multi-Format Output System**
- Text formatter for human-readable output
- Markdown formatter for documentation
- JSON formatter for programmatic use
- Consistent formatting across all plugins
```

### Core Principles

1. **Self-Contained Plugins**: Each plugin is independent and can work standalone
2. **Shared Utilities**: Common functionality is centralized to avoid duplication
3. **Type Safety**: Full TypeScript support throughout the codebase
4. **Performance**: Built-in caching and performance monitoring
5. **Extensibility**: Easy to add new plugins and extend existing ones

## 🚀 Key Features

### MCP Tools Available

The server provides 8 MCP tools for project analysis:

1. **`analyze_components`** - Extract React component information
2. **`analyze_hooks`** - Analyze React hooks usage
3. **`analyze_pages`** - Analyze Next.js pages structure
4. **`analyze_dependencies`** - Map import/export relationships
5. **`get_project_summary`** - Generate project overview
6. **`analyze_file`** - Detailed single file analysis
7. **`search_code`** - Search for patterns in codebase
8. **`get_metrics`** - Calculate code quality metrics

### Plugin System

Each plugin follows a standardized interface:

```typescript
interface IPlugin {
  name: string;
  version: string;
  analyze(context: PluginContext): Promise<PluginResult>;
}
```

### Common Utilities

All plugins have access to shared utilities:

- **File Operations**: Read, write, copy files with error handling
- **AST Parsing**: Parse JavaScript/TypeScript with Babel
- **Pattern Matching**: Glob patterns and file filtering
- **Caching**: In-memory and file-based caching
- **Logging**: Contextual logging with performance metrics

## 📚 Documentation Sections

### For Users
- [Getting Started](./getting-started.md) - Installation and basic usage
- [CLI Usage](./cli-usage.md) - Command-line interface guide
- [Examples](./examples/) - Real-world usage examples

### For Developers
- [Plugin Development](./plugin-development.md) - Creating new plugins
- [Common Utilities](./common-utilities.md) - Shared utility documentation
- [API Reference](./api-reference.md) - Complete API documentation
- [Contributing](./contributing.md) - Development guidelines

### Plugin Documentation
- [Component Extractor](./plugins/component-extractor.md)
- [Hooks Analyzer](./plugins/hooks-analyzer.md)
- [Pages Analyzer](./plugins/pages-analyzer.md)
- [Dependencies Mapper](./plugins/dependencies-mapper.md)

## 🔧 Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build the Project**
   ```bash
   npm run build
   ```

3. **Run Analysis**
   ```bash
   # Analyze components in a project
   npm run cli analyze-components /path/to/project

   # Get project summary
   npm run cli project-summary /path/to/project
   ```

4. **Use as MCP Server**
   ```json
   {
     "mcpServers": {
       "talk-to-project": {
         "command": "node",
         "args": ["dist/server/index.js"]
       }
     }
   }
   ```

## 🎯 Use Cases

- **Code Review**: Automated analysis of code quality and patterns
- **Documentation**: Generate documentation from code structure
- **Refactoring**: Identify components that need refactoring
- **Architecture Analysis**: Understand project structure and dependencies
- **Learning**: Understand how existing projects are structured

## 🤝 Contributing

See [Contributing Guide](./contributing.md) for development setup and guidelines.

## 📄 License

MIT License - see [LICENSE](../LICENSE) file for details.
