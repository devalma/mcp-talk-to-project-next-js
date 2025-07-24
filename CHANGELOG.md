# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
