# i18n Translation Analyzer Plugin

The i18n (internationalization) plugin provides comprehensive analysis of translation coverage and missing translation keys in your Next.js projects. It features automatic language detection, modular architecture, and detailed reporting capabilities.

## 🌍 Features

### Automatic Language Detection
- **Directory Structure**: Detects languages from `/locales/`, `/src/locales/`, `/public/locales/` folders
- **Configuration Files**: Reads from `i18next.config.js`, `next-i18next.config.js`, `package.json`
- **Translation Files**: Analyzes JSON translation file patterns
- **Smart Filtering**: Excludes false positives from `node_modules` and build directories

### Comprehensive Analysis
- **Untranslated Strings**: Finds hardcoded strings that should be wrapped for translation
- **Missing Translation Keys**: Identifies keys missing from language files
- **Translation Coverage**: Shows completeness across all detected languages
- **File-by-File Analysis**: Detailed breakdown of translation status per file

### Modular Architecture
- **Language Detector**: Standalone language detection avoiding false positives
- **AST Analyzer**: Advanced JavaScript/TypeScript parsing for string extraction
- **Translation File Analyzer**: JSON translation file processing and validation
- **Result Processor**: Intelligent aggregation and formatting of analysis results

## 🚀 Quick Start

### CLI Usage

```bash
# Basic analysis with auto-detected languages
node cli.js /path/to/project i18n

# Specific output format
node cli.js /path/to/project i18n --format=markdown

# Focus on specific file patterns
node cli.js /path/to/project i18n --pattern="src/components/**"
```

### Programmatic Usage

```typescript
import { I18nExtractorPlugin } from './src/plugins/i18n-extractor/index.js';

// Basic usage
const plugin = new I18nExtractorPlugin();
const results = await plugin.extractFromPath('/path/to/project');

// Advanced configuration
const plugin = new I18nExtractorPlugin({
  languages: ['en', 'es', 'fr'],
  filePatterns: ['src/**/*.{tsx,jsx,ts,js}'],
  excludePatterns: ['**/*.test.*', '**/node_modules/**'],
  includeUntranslated: true,
  includeMissing: true
});

const results = await plugin.extractFromPath('/path/to/project');
```

## 📊 Analysis Results

### Language Detection
```
✅ Detected languages: en, es, uk
📁 Detection methods: directory-structure, config-files
📋 Config files found: 
   - /path/to/next-i18next.config.js
   - /path/to/package.json
```

### Translation Coverage
```
📊 Translation Analysis Summary:
   • Total files analyzed: 261
   • Files with untranslated strings: 45
   • Total untranslated strings: 4,027
   • Translation calls found: 115
   • Missing translation keys: 23

🌍 Language Coverage:
   • en: 187 keys
   • es: 164 keys (-23 missing)
   • uk: 171 keys (-16 missing)
```

### Detailed Breakdown
- **Untranslated Strings**: Lists exact strings that need translation wrapping
- **Missing Keys**: Shows which translation keys are missing from language files
- **File Analysis**: Per-file breakdown of translation status
- **Pattern Matching**: Supports filtering by file patterns for focused analysis

## ⚙️ Configuration Options

### Plugin Configuration

```typescript
interface I18nExtractorConfig extends ExtractorConfig {
  languages?: string[];           // Specific languages to analyze
  filePatterns?: string[];        // File patterns to include
  excludePatterns?: string[];     // Patterns to exclude
  includeUntranslated?: boolean;  // Include untranslated strings
  includeMissing?: boolean;       // Include missing translation keys
  translationFilePattern?: string; // Custom translation file pattern
  i18nLibraries?: string[];       // Supported i18n libraries
}
```

### Default Configuration

```typescript
{
  filePatterns: ['**/*.{js,jsx,ts,tsx}'],
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/*.test.*',
    '**/*.spec.*'
  ],
  includeUntranslated: true,
  includeMissing: true,
  translationFilePattern: '**/locales/**/*.json',
  i18nLibraries: ['react-i18next', 'next-i18next', 'i18next']
}
```

## 🏗️ Architecture

### Module Structure

```
src/plugins/i18n-extractor/
├── types.ts                    # Type definitions and interfaces
├── config.ts                   # Configuration constants
├── language-detector.ts        # Language detection logic
├── ast-analyzer.ts            # AST parsing and string extraction
├── translation-file-analyzer.ts # Translation file processing
├── result-processor.ts        # Result aggregation
├── plugin-new.ts              # Main orchestrator
├── formatter.ts               # Output formatting
└── index.ts                   # Module exports
```

### Key Components

#### Language Detector
- Detects project languages from multiple sources
- Avoids false positives from build artifacts
- Supports complex i18n configurations
- Provides detailed detection metadata

#### AST Analyzer
- Parses JavaScript/TypeScript files using Babel
- Identifies string literals that need translation
- Finds existing translation function calls
- Supports JSX and template literals

#### Translation File Analyzer
- Processes JSON translation files
- Identifies missing keys across languages
- Validates translation file structure
- Supports nested translation keys

#### Result Processor
- Aggregates analysis results intelligently
- Calculates coverage statistics
- Formats output for different consumers
- Provides detailed reporting

## 🔍 Detection Patterns

### Language Detection

The plugin uses multiple methods to detect project languages:

1. **Directory Structure**:
   ```
   /locales/en/common.json
   /locales/es/common.json
   /src/locales/uk/navigation.json
   ```

2. **Configuration Files**:
   ```javascript
   // next-i18next.config.js
   module.exports = {
     i18n: {
       locales: ['en', 'es', 'uk'],
       defaultLocale: 'en'
     }
   };
   ```

3. **Package Dependencies**:
   ```json
   {
     "dependencies": {
       "next-i18next": "^13.0.0",
       "react-i18next": "^12.0.0"
     }
   }
   ```

### String Detection

The plugin identifies various string patterns that need translation:

```typescript
// Hardcoded strings (need translation)
const title = "Welcome to our app";
const message = `Hello ${user.name}`;

// Already translated (detected as translated)
const title = t('welcome.title');
const message = i18n.t('greeting.message', { name: user.name });
```

## 📈 Performance

### Optimization Features
- **Caching**: AST parsing results are cached for performance
- **Parallel Processing**: Files are processed in parallel batches
- **Smart Filtering**: Excludes irrelevant files early in the process
- **Incremental Analysis**: Supports analyzing specific directories or patterns

### Performance Metrics
- **Large Projects**: Handles 1000+ files efficiently
- **Memory Usage**: Optimized memory usage with streaming processing
- **Processing Speed**: ~50-100 files per second depending on complexity

## 🧪 Testing

### Test Coverage
The plugin includes comprehensive tests for:
- Language detection accuracy
- String extraction precision
- Translation file parsing
- Result aggregation correctness
- Performance benchmarks

### Example Test Cases
```typescript
describe('Language Detection', () => {
  it('should detect languages from directory structure', async () => {
    const detector = new LanguageDetector();
    const result = await detector.detectProjectLanguages('/test/project');
    expect(result.languages).toEqual(['en', 'es', 'uk']);
  });

  it('should avoid false positives from node_modules', async () => {
    const result = await detector.detectProjectLanguages('/project/with/node_modules');
    expect(result.languages).not.toContain('co'); // from node_modules/co
  });
});
```

## 🔧 Troubleshooting

### Common Issues

1. **Languages Not Detected**:
   - Check directory structure matches patterns
   - Verify configuration file syntax
   - Ensure translation files exist

2. **False Positives in Detection**:
   - Review exclude patterns
   - Check for build artifacts in analysis
   - Verify file pattern specificity

3. **Performance Issues**:
   - Reduce file pattern scope
   - Increase exclude patterns
   - Use specific directory targeting

### Debug Mode

Enable detailed logging for troubleshooting:

```typescript
const plugin = new I18nExtractorPlugin({
  debug: true,
  logLevel: 'debug'
});
```

## 🚀 Future Enhancements

### Planned Features
- **React Native Support**: Extend support for React Native i18n patterns
- **Nested Key Analysis**: Better handling of nested translation keys
- **Pluralization Detection**: Identify plural form requirements
- **RTL Language Support**: Right-to-left language specific analysis
- **Translation Memory**: Integration with translation management systems

### Contributing

The modular architecture makes it easy to contribute:
1. **Language Detector**: Add support for new i18n libraries
2. **AST Analyzer**: Improve string detection patterns
3. **Formatters**: Add new output formats
4. **Integrations**: Connect with translation services

## 📚 Related Documentation

- [Plugin Development Guide](../plugin-development.md) - Learn about the plugin architecture
- [Common Utilities](../common-utilities.md) - Shared utilities used by the plugin
- [Getting Started](../getting-started.md) - Project setup and configuration
- [API Reference](../api-reference.md) - Complete API documentation

---

The i18n plugin showcases the power of our modular plugin architecture, demonstrating how complex analysis tasks can be broken down into focused, maintainable components while providing comprehensive functionality for real-world projects.
