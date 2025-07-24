# Plugin Development Guide

Learn how to create powerful plugins for the MCP Talk to Project system using our DRY (Don't Repeat Yourself) architecture. This guide focuses on the modern BaseExtractor approach for efficient, maintainable plugin development.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [DRY Architecture](#dry-architecture)
- [Using Specialized Utilities](#using-specialized-utilities)
- [Advanced Configuration](#advanced-configuration)
- [Testing Plugins](#testing-plugins)
- [Best Practices](#best-practices)
- [Examples](#examples)

## 🚀 Quick Start

Creating a plugin is now incredibly simple with our DRY architecture. Most plugins extend `BaseExtractor` for automatic file processing and can be built in under 100 lines of code.

### Step 1: Create Plugin File

Create `src/plugins/your-analyzer/plugin.ts`:

```typescript
import { BaseExtractor, type ExtractorConfig } from '../common/base-extractor.js';
import { ReactComponentUtils } from '../common/react-component-utils.js';
import { ReactHooksUtils } from '../common/react-hooks-utils.js';
import type { PluginMetadata } from '../../types/plugin.js';

// Define your result types
interface MyAnalysisResult {
  filePath: string;
  components: number;
  hooks: string[];
}

interface MySummary {
  totalFiles: number;
  totalComponents: number;
  mostUsedHooks: Array<{ name: string; count: number }>;
}

export class MyAnalyzerPlugin extends BaseExtractor<MyAnalysisResult, MySummary> {
  get metadata(): PluginMetadata {
    return {
      name: 'my-analyzer',
      version: '1.0.0',
      description: 'Analyzes React components and hooks',
      author: 'Your Name',
      tags: ['react', 'components', 'hooks']
    };
  }

  // Configure file patterns
  constructor(config: ExtractorConfig = {}) {
    super({
      filePatterns: ['**/*.{tsx,jsx}'],
      excludePatterns: ['**/*.test.*', '**/*.stories.*'],
      batchSize: 5,
      parallel: true,
      ...config
    });
  }

  // Determine which files to process
  protected shouldProcessFile(filePath: string): boolean {
    const content = this.readFileSync(filePath);
    if (!content) return false;
    
    const ast = this.parseWithCache(filePath, content);
    return ast ? ReactComponentUtils.isReactComponentFile(ast) : false;
  }

  // Process individual files - this is where your logic goes
  protected async processFile(filePath: string, content: string): Promise<MyAnalysisResult | null> {
    try {
      // Parse with automatic caching
      const ast = this.parseWithCache(filePath, content);
      if (!ast) return null;

      // Use shared utilities for analysis
      const components = ReactComponentUtils.findReactComponents(ast);
      const hooks = ReactHooksUtils.findCustomHooks(ast);

      return {
        filePath,
        components: components.length,
        hooks: hooks.map(h => h.name)
      };

    } catch (error) {
      this.logger.error(`Failed to process ${filePath}:`, error);
      return null;
    }
  }

  // Aggregate all file results into a summary
  protected aggregateResults(results: MyAnalysisResult[]): MySummary {
    const hookCounts = new Map<string, number>();
    
    let totalComponents = 0;
    for (const result of results) {
      totalComponents += result.components;
      
      for (const hook of result.hooks) {
        hookCounts.set(hook, (hookCounts.get(hook) || 0) + 1);
      }
    }

    const mostUsedHooks = Array.from(hookCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    return {
      totalFiles: results.length,
      totalComponents,
      mostUsedHooks
    };
  }
}
```

### Step 2: Create Index Export

Create `src/plugins/your-analyzer/index.ts`:

```typescript
export { MyAnalyzerPlugin } from './plugin.js';
export type { MyAnalysisResult, MySummary } from './plugin.js';
```

### Step 3: Use Your Plugin

```typescript
import { MyAnalyzerPlugin } from './plugins/your-analyzer/index.js';

const plugin = new MyAnalyzerPlugin({
  batchSize: 10,
  parallel: true,
  excludePatterns: ['**/*.test.*']
});

const result = await plugin.extract('/path/to/react/project');
console.log(result.data); // MySummary with aggregated results
```

## 🏗️ DRY Architecture

### Core Benefits

- **79% code reduction** compared to traditional approaches
- **Built-in error handling** and logging
- **Automatic caching** for AST parsing
- **Parallel processing** support
- **Consistent results** across all plugins

### Plugin Directory Structure

Modern plugins are incredibly simple:

```
src/plugins/your-plugin/
├── index.ts           # Main plugin export  
├── plugin.ts          # Plugin implementation extending BaseExtractor
└── README.md          # Plugin documentation (optional)
```

### Shared Utilities

The DRY architecture provides these specialized utilities:

```
src/plugins/common/
├── base-extractor.ts       # Base class for file-based plugins
├── react-component-utils.ts # React component analysis
├── react-hooks-utils.ts     # React hooks analysis  
├── nextjs-utils.ts          # Next.js specific utilities
├── react-context-utils.ts   # React Context analysis
├── ast-utils.ts             # Generic AST traversal
├── file-utils.ts            # File system operations
├── cache-utils.ts           # Caching functionality
└── logger.ts               # Consistent logging
```

### BaseExtractor Features

When you extend `BaseExtractor`, you automatically get:

```typescript
// Automatic file discovery and filtering
const files = await this.discoverFiles(targetPath);

// Smart caching for performance
const ast = this.parseWithCache(filePath, content);

// Batch processing with parallel support
const results = await this.processFiles(files);

// Built-in error handling and logging
this.logger.info('Processing started', { files: files.length });

// Performance monitoring
this.startTimer('analysis');
this.logTiming('analysis');
```

## 🔧 Using Specialized Utilities

Our DRY architecture provides powerful utilities for common analysis tasks:

### React Component Analysis

```typescript
import { ReactComponentUtils } from '../common/react-component-utils.js';

protected async processFile(filePath: string, content: string): Promise<MyResult | null> {
  const ast = this.parseWithCache(filePath, content);
  if (!ast) return null;

  // Check if file contains React components
  if (!ReactComponentUtils.isReactComponentFile(ast)) {
    return null;
  }

  // Find all components in the file
  const components = ReactComponentUtils.findReactComponents(ast);
  
  // Analyze specific aspects
  for (const component of components) {
    const isFunctional = ReactComponentUtils.isFunctionalComponent(ast, component.name);
    const hasProps = ReactComponentUtils.hasProps(ast, component.name);
    const hooks = ReactComponentUtils.extractComponentHooks(ast, component.name);
    
    this.logger.info(`${component.name}: functional=${isFunctional}, props=${hasProps}, hooks=${hooks.length}`);
  }

  return { filePath, components };
}
```

### React Hooks Analysis

```typescript
import { ReactHooksUtils } from '../common/react-hooks-utils.js';

protected async processFile(filePath: string, content: string): Promise<MyResult | null> {
  const ast = this.parseWithCache(filePath, content);
  if (!ast) return null;

  // Find custom hooks
  const customHooks = ReactHooksUtils.findCustomHooks(ast);
  
  // Find hook usage in components
  const hookUsage = ReactHooksUtils.findHookUsage(ast, ['useState', 'useEffect']);
  
  // Validate hook rules
  const violations = ReactHooksUtils.validateHookRules(ast);
  
  // Analyze dependencies
  const dependencies = ReactHooksUtils.analyzeHookDependencies(ast);

  return {
    filePath,
    customHooks: customHooks.length,
    hookUsage: hookUsage.length,
    violations: violations.length,
    dependencies: dependencies.length
  };
}
```

### Next.js Specific Analysis

```typescript
import { NextJSUtils } from '../common/nextjs-utils.js';

protected async processFile(filePath: string, content: string): Promise<MyResult | null> {
  const ast = this.parseWithCache(filePath, content);
  if (!ast) return null;

  // Check Next.js specific patterns
  const isPage = NextJSUtils.isNextJSPage(filePath);
  const isAPIRoute = NextJSUtils.isAPIRoute(filePath);
  const isDynamicRoute = NextJSUtils.isDynamicRoute(filePath);
  
  // Extract Next.js specific exports
  const exports = NextJSUtils.findNextJSExports(ast);
  
  return {
    filePath,
    isPage,
    isAPIRoute,
    isDynamicRoute,
    exports: exports.length
  };
}
```

### React Context Analysis

```typescript
import { ReactContextUtils } from '../common/react-context-utils.js';

protected async processFile(filePath: string, content: string): Promise<MyResult | null> {
  const ast = this.parseWithCache(filePath, content);
  if (!ast) return null;

  // Find context definitions
  const contexts = ReactContextUtils.findContextDefinitions(ast);
  
  // Find context usage
  const usage = ReactContextUtils.findContextUsage(ast);
  
  // Performance analysis
  const performance = ReactContextUtils.analyzeContextPerformance(ast);

  return {
    filePath,
    contexts: contexts.length,
    usage: usage.length,
    hasPerformanceIssues: performance.hasIssues
  };
}
```

## ⚙️ Advanced Configuration

### Configuring File Processing

```typescript
export class MyPlugin extends BaseExtractor<MyResult, MySummary> {
  constructor(config: ExtractorConfig = {}) {
    super({
      // File patterns to include
      filePatterns: ['**/*.{tsx,jsx,ts,js}'],
      
      // Files to exclude
      excludePatterns: [
        '**/node_modules/**',
        '**/*.test.*',
        '**/*.stories.*',
        '**/dist/**'
      ],
      
      // Performance tuning
      maxFileSize: 2 * 1024 * 1024, // 2MB limit
      batchSize: 8, // Process 8 files at a time
      parallel: true, // Enable parallel processing
      
      // Include node_modules if needed
      includeNodeModules: false,
      
      ...config
    });
  }
}
```

### Custom Configuration Types

```typescript
interface MyPluginConfig extends ExtractorConfig {
  analyzeProps?: boolean;
  trackHooks?: boolean;
  outputFormat?: 'json' | 'markdown';
  minComponentSize?: number;
}

export class MyPlugin extends BaseExtractor<MyResult, MySummary> {
  private customConfig: MyPluginConfig;

  constructor(config: MyPluginConfig = {}) {
    const defaultConfig: MyPluginConfig = {
      analyzeProps: true,
      trackHooks: true,
      outputFormat: 'json',
      minComponentSize: 10,
      ...config
    };

    super(defaultConfig);
    this.customConfig = defaultConfig;
  }

  protected async processFile(filePath: string, content: string): Promise<MyResult | null> {
    // Use custom configuration
    if (content.length < this.customConfig.minComponentSize!) {
      return null;
    }

    // Continue with processing...
  }
}
```

## 🧪 Testing Plugins

### Testing BaseExtractor Plugins

```typescript
// tests/my-analyzer.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { MyAnalyzerPlugin } from '../src/plugins/my-analyzer/plugin.js';

describe('MyAnalyzerPlugin', () => {
  let plugin: MyAnalyzerPlugin;
  
  beforeEach(() => {
    plugin = new MyAnalyzerPlugin({
      includeTests: false,
      batchSize: 2 // Smaller batches for testing
    });
  });

  it('should process React components correctly', async () => {
    const result = await plugin.extract('./test-fixtures/react-project');
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.totalFiles).toBeGreaterThan(0);
    expect(result.data.totalComponents).toBeGreaterThan(0);
  });

  it('should handle empty projects gracefully', async () => {
    const result = await plugin.extract('./test-fixtures/empty-project');
    
    expect(result.success).toBe(true);
    expect(result.data.totalFiles).toBe(0);
    expect(result.data.totalComponents).toBe(0);
  });

  it('should respect file patterns', async () => {
    const plugin = new MyAnalyzerPlugin({
      filePatterns: ['**/*.tsx'], // Only TypeScript React files
      excludePatterns: ['**/*.test.*']
    });
    
    const result = await plugin.extract('./test-fixtures/mixed-project');
    
    expect(result.success).toBe(true);
    // Should only process .tsx files, not .jsx
  });

  it('should handle parse errors gracefully', async () => {
    const result = await plugin.extract('./test-fixtures/invalid-syntax');
    
    expect(result.success).toBe(true);
    expect(result.warnings).toBeDefined();
    // Should continue processing other files despite parse errors
  });
});
```

### Testing Specialized Utilities

```typescript
// tests/react-component-utils.test.ts
import { describe, it, expect } from 'vitest';
import { ReactComponentUtils } from '../src/plugins/common/react-component-utils.js';
import { ASTUtils } from '../src/plugins/common/ast-utils.js';

describe('ReactComponentUtils', () => {
  it('should detect functional components', () => {
    const code = `
      import React from 'react';
      
      export const Button = ({ children, onClick }) => {
        return <button onClick={onClick}>{children}</button>;
      };
    `;
    
    const ast = ASTUtils.parseCode(code);
    const components = ReactComponentUtils.findReactComponents(ast);
    
    expect(components).toHaveLength(1);
    expect(components[0].name).toBe('Button');
    expect(components[0].type).toBe('functional');
  });

  it('should detect class components', () => {
    const code = `
      import React, { Component } from 'react';
      
      export class MyComponent extends Component {
        render() {
          return <div>Hello</div>;
        }
      }
    `;
    
    const ast = ASTUtils.parseCode(code);
    const components = ReactComponentUtils.findReactComponents(ast);
    
    expect(components).toHaveLength(1);
    expect(components[0].name).toBe('MyComponent');
    expect(components[0].type).toBe('class');
  });
});
```

### Integration Testing

```typescript
// tests/integration/plugin-system.test.ts
import { describe, it, expect } from 'vitest';
import { pluginRegistry } from '../src/plugins/registry.js';

describe('Plugin System Integration', () => {
  it('should load all plugins correctly', () => {
    const plugins = pluginRegistry.getAllPlugins();
    
    expect(plugins.length).toBeGreaterThan(0);
    
    for (const plugin of plugins) {
      expect(plugin.name).toBeDefined();
      expect(plugin.version).toBeDefined();
      expect(typeof plugin.analyze).toBe('function');
    }
  });

  it('should run all plugins on test project', async () => {
    const results = await Promise.all(
      pluginRegistry.getAllPlugins().map(plugin => 
        plugin.analyze('./test-fixtures/sample-project')
      )
    );

    for (const result of results) {
      expect(result.success).toBe(true);
      expect(result.metadata?.processingTime).toBeDefined();
    }
  });
});
```

### Test Fixtures

Create test fixtures for consistent testing:

```
tests/fixtures/
├── sample-project/
│   ├── package.json
│   ├── src/
│   │   ├── components/
│   │   │   └── Button.tsx
│   │   ├── hooks/
│   │   │   └── useCounter.ts
│   │   └── pages/
│   │       └── index.tsx
│   └── README.md
└── invalid-syntax/
    └── broken.js
```

## ✅ Best Practices

### Plugin Structure

```typescript
// ✅ Good: Clean, focused plugin with proper TypeScript types
export class WellStructuredPlugin extends BaseExtractor<ComponentResult, ComponentSummary> {
  get metadata(): PluginMetadata {
    return {
      name: 'well-structured-plugin',
      version: '1.0.0',
      description: 'A well-structured plugin example',
      author: 'Your Name',
      tags: ['react', 'analysis']
    };
  }

  constructor(config: ExtractorConfig = {}) {
    super({
      filePatterns: ['**/*.{tsx,jsx}'],
      excludePatterns: ['**/*.test.*'],
      batchSize: 5,
      parallel: true,
      ...config
    });
  }

  protected shouldProcessFile(filePath: string): boolean {
    // Clear, simple logic
    return !filePath.includes('node_modules');
  }

  protected async processFile(filePath: string, content: string): Promise<ComponentResult | null> {
    try {
      const ast = this.parseWithCache(filePath, content);
      if (!ast) return null;

      // Use utilities for heavy lifting
      const components = ReactComponentUtils.findReactComponents(ast);
      
      return {
        filePath,
        components: components.length,
        componentNames: components.map(c => c.name)
      };

    } catch (error) {
      this.logger.error(`Processing failed for ${filePath}`, error);
      return null;
    }
  }

  protected aggregateResults(results: ComponentResult[]): ComponentSummary {
    return {
      totalFiles: results.length,
      totalComponents: results.reduce((sum, r) => sum + r.components, 0),
      filesByComponentCount: results
        .sort((a, b) => b.components - a.components)
        .slice(0, 10)
    };
  }
}
```

### Performance Optimization

```typescript
// ✅ Good: Efficient file processing
export class OptimizedPlugin extends BaseExtractor<MyResult, MySummary> {
  constructor(config: ExtractorConfig = {}) {
    super({
      // Tune for your use case
      batchSize: 8, // Process 8 files simultaneously
      maxFileSize: 1024 * 1024, // Skip files larger than 1MB
      parallel: true, // Enable parallel processing
      
      // Exclude unnecessary files early
      excludePatterns: [
        '**/node_modules/**',
        '**/*.d.ts',
        '**/*.map',
        '**/dist/**',
        '**/build/**'
      ],
      ...config
    });
  }

  protected shouldProcessFile(filePath: string): boolean {
    // Quick checks first
    if (filePath.endsWith('.test.ts')) return false;
    if (filePath.includes('__tests__')) return false;
    
    // More expensive checks only if needed
    const content = this.readFileSync(filePath);
    return content ? this.isRelevantFile(content) : false;
  }

  private isRelevantFile(content: string): boolean {
    // Quick string checks before AST parsing
    return content.includes('React') || content.includes('export');
  }
}
```

### Error Handling

```typescript
// ✅ Good: Robust error handling
export class RobustPlugin extends BaseExtractor<MyResult, MySummary> {
  protected async processFile(filePath: string, content: string): Promise<MyResult | null> {
    try {
      // Validate input
      if (!content || content.trim().length === 0) {
        this.logger.warn(`Empty file skipped: ${filePath}`);
        return null;
      }

      // Parse with error handling
      const ast = this.parseWithCache(filePath, content);
      if (!ast) {
        this.logger.warn(`Parse failed: ${filePath}`);
        return null;
      }

      // Process with try-catch for specific errors
      const result = await this.analyzeAST(ast, filePath);
      
      if (!result) {
        this.logger.debug(`No results for: ${filePath}`);
        return null;
      }

      return result;

    } catch (error) {
      // Log with context but don't fail the entire process
      this.logger.error(`Processing failed for ${filePath}`, {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      });
      return null;
    }
  }

  private async analyzeAST(ast: any, filePath: string): Promise<MyResult | null> {
    try {
      // Your analysis logic here
      return { filePath, data: [] };
    } catch (error) {
      throw new Error(`AST analysis failed: ${error.message}`);
    }
  }
}
```

### Configuration

```typescript
// ✅ Good: Well-documented configuration with defaults
interface MyPluginConfig extends ExtractorConfig {
  /** Include test files in analysis */
  includeTests?: boolean;
  /** Minimum component size to analyze */
  minComponentLines?: number;
  /** Output format for results */
  outputFormat?: 'json' | 'csv' | 'markdown';
  /** Custom patterns for component detection */
  componentPatterns?: string[];
}

export class ConfigurablePlugin extends BaseExtractor<MyResult, MySummary> {
  private config: Required<MyPluginConfig>;

  constructor(userConfig: MyPluginConfig = {}) {
    // Merge with sensible defaults
    const config: Required<MyPluginConfig> = {
      // BaseExtractor defaults
      filePatterns: ['**/*.{tsx,jsx}'],
      excludePatterns: ['**/node_modules/**'],
      batchSize: 5,
      parallel: true,
      maxFileSize: 1024 * 1024,
      includeNodeModules: false,
      
      // Plugin-specific defaults
      includeTests: false,
      minComponentLines: 5,
      outputFormat: 'json',
      componentPatterns: ['Component', 'Page', 'Layout'],
      
      ...userConfig
    };

    super(config);
    this.config = config;
  }

  protected shouldProcessFile(filePath: string): boolean {
    // Use configuration in logic
    if (!this.config.includeTests && filePath.includes('.test.')) {
      return false;
    }

    return super.shouldProcessFile(filePath);
  }
}
```

## � Examples

### Real-World Plugin Examples

**Component Extractor Plugin**: A complete example using our DRY architecture:

- **Location**: [src/plugins/component-extractor/](../src/plugins/component-extractor/)
- **What it does**: Analyzes React components and hooks
- **Lines of code**: ~150 lines (down from 850+ in monolithic approach)
- **Key features**: Parallel processing, component analysis, hook detection, performance monitoring

**Quick Implementation Examples**:

```typescript
// 1. Import Analyzer Plugin (30 lines)
export class ImportAnalyzerPlugin extends BaseExtractor<ImportResult, ImportSummary> {
  protected async processFile(filePath: string, content: string): Promise<ImportResult | null> {
    const ast = this.parseWithCache(filePath, content);
    if (!ast) return null;

    const imports = ASTUtils.findImports(ast);
    return {
      filePath,
      importCount: imports.length,
      externalDeps: imports.filter(i => !i.source.startsWith('.')).map(i => i.source)
    };
  }

  protected aggregateResults(results: ImportResult[]): ImportSummary {
    const allDeps = new Set<string>();
    results.forEach(r => r.externalDeps.forEach(dep => allDeps.add(dep)));
    
    return {
      totalFiles: results.length,
      uniqueDependencies: allDeps.size,
      mostImported: Array.from(allDeps).slice(0, 10)
    };
  }
}

// 2. Hook Usage Plugin (25 lines)
export class HookUsagePlugin extends BaseExtractor<HookResult, HookSummary> {
  protected async processFile(filePath: string, content: string): Promise<HookResult | null> {
    const ast = this.parseWithCache(filePath, content);
    if (!ast) return null;

    const hooks = ReactHooksUtils.findHookUsage(ast);
    return { filePath, hooks: hooks.map(h => h.name) };
  }

  protected aggregateResults(results: HookResult[]): HookSummary {
    const hookCounts = new Map<string, number>();
    results.forEach(r => 
      r.hooks.forEach(hook => 
        hookCounts.set(hook, (hookCounts.get(hook) || 0) + 1)
      )
    );

    return {
      totalFiles: results.length,
      mostUsedHooks: Array.from(hookCounts.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }))
    };
  }
}
```

## 🔗 Next Steps

1. **Start with BaseExtractor**: Use it for 90% of use cases
2. **Leverage Utilities**: Use specialized utilities for React, Next.js analysis
3. **Write Tests**: Test your plugins with our testing patterns
4. **Add Documentation**: Document your plugin's purpose and usage
5. **Register Plugin**: Add to the plugin manager for discoverability

**Key Resources**:
- [Component Extractor Example](../src/plugins/component-extractor/) - Full working plugin
- [DRY Utilities](../src/plugins/common/) - Shared utilities and base classes
- [Plugin Types](../src/types/plugin.ts) - TypeScript interfaces
- [Test Examples](../tests/) - Testing patterns and fixtures

**Common Plugin Ideas**:
- **API Route Analyzer**: Find and analyze Next.js API routes
- **State Management**: Detect Redux, Zustand, or Context usage
- **Performance**: Find potential performance issues
- **Security**: Scan for security anti-patterns
- **Accessibility**: Check for a11y compliance
- **Bundle Size**: Analyze import patterns for optimization
- **i18n Translation Analysis**: Analyze internationalization and translation coverage (see example below)

## 🌍 Real-World Example: i18n Translation Plugin

The i18n plugin demonstrates advanced modular architecture and complex analysis patterns. Here's how it's structured:

### Modular Architecture

The i18n plugin is split into focused modules for maintainability:

```
src/plugins/i18n-extractor/
├── types.ts              # Type definitions and interfaces
├── config.ts             # Configuration constants and patterns
├── language-detector.ts  # Language detection logic
├── ast-analyzer.ts       # AST analysis for string extraction
├── translation-file-analyzer.ts  # Translation file analysis
├── result-processor.ts   # Result aggregation and formatting
├── plugin-new.ts         # Main orchestrator plugin
├── formatter.ts          # Output formatting
└── index.ts              # Module exports
```

### Key Features

1. **Automatic Language Detection**: Detects project languages from:
   - Directory structure (`/locales/en/`, `/locales/es/`)
   - Configuration files (i18next, package.json)
   - Translation file patterns
   - Excludes false positives from node_modules

2. **Comprehensive Analysis**:
   - Finds untranslated strings in source code
   - Identifies missing translation keys
   - Analyzes translation file completeness
   - Supports complex i18n setups

3. **Modular Design Benefits**:
   - Each module has a single responsibility
   - Components can be used independently
   - Easy to test and maintain
   - Clear separation of concerns

### Example Usage

```typescript
import { I18nExtractorPlugin } from '../plugins/i18n-extractor/index.js';

// Basic usage with auto-detection
const plugin = new I18nExtractorPlugin();
const results = await plugin.extractFromPath('/path/to/project');

// Advanced configuration
const plugin = new I18nExtractorPlugin({
  languages: ['en', 'es', 'fr'],
  filePatterns: ['src/**/*.{tsx,jsx}'],
  excludePatterns: ['**/*.test.*', '**/node_modules/**'],
  includeUntranslated: true,
  includeMissing: true
});
```

### CLI Integration

```bash
# Analyze entire project
node cli.js /path/to/project i18n

# Specific analysis with formatting
node cli.js /path/to/project i18n --format=markdown

# Component-focused analysis
node cli.js /path/to/project i18n --pattern="src/components/**"
```

This example shows how to build sophisticated, production-ready plugins using our modular architecture principles.

Start building your plugin today with our DRY architecture! 🚀
