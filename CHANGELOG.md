# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Preparing for next release

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
