# Common Utilities Documentation

The common utilities provide a standardized set of tools that all plugins can use, ensuring consistency and reducing code duplication across the plugin ecosystem.

## 📋 Table of Contents

- [Overview](#overview)
- [File Operations](#file-operations)
- [AST Utilities](#ast-utilities)
- [Pattern Matching](#pattern-matching)
- [Caching System](#caching-system)
- [Logging](#logging)
- [Plugin Context](#plugin-context)
- [Best Practices](#best-practices)

## 🎯 Overview

All common utilities are available through a single import:

```typescript
import {
  FileUtils,
  ASTUtils,
  PatternUtils,
  PathUtils,
  PluginCache,
  PluginLogger,
  createPluginContext,
  createPluginResult
} from '../common/index.js';
```

## 📁 File Operations (`FileUtils`)

Robust file system operations with comprehensive error handling.

### Core Methods

```typescript
// Read file contents
const content = await FileUtils.readFile(filePath);
const contentWithFallback = await FileUtils.readFile(filePath, 'default content');

// Write file contents
await FileUtils.writeFile(filePath, content);
await FileUtils.appendToFile(filePath, additionalContent);

// File system operations
const exists = await FileUtils.fileExists(filePath);
const isDir = FileUtils.isDirectory(path);
const stats = await FileUtils.getFileStats(filePath);

// Directory operations
await FileUtils.ensureDirectoryExists(dirPath);
const files = await FileUtils.listFiles(dirPath);
const allFiles = await FileUtils.listFilesRecursive(dirPath);

// File utilities
const ext = FileUtils.getFileExtension('component.tsx'); // '.tsx'
const name = FileUtils.getBaseName('component.tsx'); // 'component'
const tempFile = await FileUtils.createTempFile('prefix', content);

// Copy operations
await FileUtils.copyFile(sourcePath, destPath);
await FileUtils.copyDirectory(sourceDir, destDir);
```

### Error Handling

All file operations include comprehensive error handling:

```typescript
try {
  const content = await FileUtils.readFile('/nonexistent/file.txt');
} catch (error) {
  // Detailed error with context
  console.error('File operation failed:', error.message);
}
```

### File Size Management

```typescript
// Check file size before processing
const stats = await FileUtils.getFileStats(filePath);
if (stats.size > 1024 * 1024) { // 1MB
  console.warn('Large file detected:', filePath);
}

// Read with size limit
const content = await FileUtils.readFile(filePath);
if (content.length > 100000) {
  console.warn('Large content size:', content.length);
}
```

## 🌳 AST Utilities (`ASTUtils`)

Powerful Abstract Syntax Tree parsing and analysis using Babel.

### Parsing Files

```typescript
// Parse any JavaScript/TypeScript file
const ast = await ASTUtils.parseFile('/path/to/component.tsx');

// Parse code string directly
const ast = ASTUtils.parseCode(codeString, 'component.tsx');

// Parse with custom options
const ast = ASTUtils.parseCodeWithOptions(code, {
  sourceType: 'module',
  plugins: ['jsx', 'typescript']
});
```

### Extracting Information

```typescript
// Extract imports
const imports = ASTUtils.findImports(ast);
/* Returns:
[
  {
    source: 'react',
    imports: [{ imported: 'default', local: 'React' }],
    isDefault: true,
    isNamespace: false
  }
]
*/

// Extract exports
const exports = ASTUtils.findExports(ast);
/* Returns:
[
  { name: 'ComponentName', type: 'default' },
  { name: 'helperFunction', type: 'named' }
]
*/

// Find function calls
const calls = ASTUtils.findFunctionCalls(ast, 'useState');
/* Returns:
[
  { name: 'useState', arguments: 1, line: 15 }
]
*/
```

### AST Traversal

```typescript
// Custom AST traversal
ASTUtils.traverse(ast, {
  FunctionDeclaration(path) {
    console.log('Found function:', path.node.id?.name);
  },
  
  CallExpression(path) {
    if (path.node.callee.name === 'useEffect') {
      console.log('Found useEffect at line:', path.node.loc?.start.line);
    }
  },
  
  JSXElement(path) {
    console.log('Found JSX element:', path.node.openingElement.name.name);
  }
});
```

### Advanced Analysis

```typescript
// Check if function returns JSX
const containsJSX = ASTUtils.containsJSX(functionPath);

// Calculate cyclomatic complexity
const complexity = ASTUtils.calculateComplexity(functionPath);

// Analyze React components
const components = ASTUtils.extractReactComponents(ast);
const hooks = ASTUtils.extractHooks(ast);
```

### Supported File Types

- **JavaScript**: `.js`, `.mjs`
- **TypeScript**: `.ts`, `.mts`
- **React**: `.jsx`, `.tsx`
- **Modern Features**: ES2020+, decorators, optional chaining, etc.

## 🔍 Pattern Matching (`PatternUtils`, `PathUtils`)

Flexible file pattern matching and path utilities.

### Pattern Matching

```typescript
// Check if file matches pattern
const matches = PatternUtils.matchesPattern('/src/components/Button.tsx', '**/*.tsx');

// Find files by patterns
const files = await PatternUtils.findFiles('/project/root', [
  'src/**/*.{ts,tsx}',
  '!src/**/*.test.{ts,tsx}',
  '!src/**/*.stories.{ts,tsx}'
]);

// Filter existing file list
const filteredFiles = PatternUtils.filterByPatterns(allFiles, {
  include: ['src/**/*.tsx'],
  exclude: ['src/**/*.test.tsx']
});

// Pattern validation
const isValid = PatternUtils.isValidGlobPattern('src/**/*.{ts,tsx}');
```

### Path Utilities

```typescript
// Path operations
const isInside = PathUtils.isInDirectory('/src/components/Button.tsx', '/src/components');
const relative = PathUtils.getRelativePath('/project/src', '/project/src/components/Button.tsx');
const normalized = PathUtils.normalizeToUnix('src\\components\\Button.tsx');

// Path analysis
const depth = PathUtils.getPathDepth('/src/components/ui/Button.tsx'); // 4
const parent = PathUtils.getParentDirectory('/src/components/Button.tsx'); // '/src/components'
```

### Common Patterns

```typescript
// React component patterns
const componentPatterns = [
  'src/components/**/*.{tsx,jsx}',
  'src/pages/**/*.{tsx,jsx}',
  'app/**/*.{tsx,jsx}'
];

// Test file patterns
const testPatterns = [
  '**/*.test.{ts,tsx,js,jsx}',
  '**/*.spec.{ts,tsx,js,jsx}',
  '**/__tests__/**/*.{ts,tsx,js,jsx}'
];

// Configuration patterns
const configPatterns = [
  '*.config.{js,ts}',
  '.*.{js,json}',
  'package.json'
];
```

## 💾 Caching System (`PluginCache`, `FileCache`)

Intelligent caching to improve performance and reduce redundant operations.

### In-Memory Cache (`PluginCache`)

```typescript
// Create cache with TTL
const cache = new PluginCache<string, ComponentInfo>();

// Store with default TTL (1 hour)
cache.set('component-key', componentData);

// Store with custom TTL (30 minutes)
cache.set('component-key', componentData, 30 * 60 * 1000);

// Retrieve from cache
const cached = cache.get('component-key');
if (cached) {
  console.log('Cache hit!');
}

// Check cache status
const exists = cache.has('component-key');
const size = cache.size();

// Clear cache
cache.clear();
cache.delete('component-key');
```

### File-Based Cache (`FileCache`)

```typescript
// Create persistent cache
const fileCache = new FileCache('/cache/directory');

// Store data (automatically serialized)
await fileCache.set('analysis-result', complexData);

// Retrieve data (automatically deserialized)
const cached = await fileCache.get('analysis-result');

// Cache with TTL
await fileCache.set('temp-data', data, 60 * 60 * 1000); // 1 hour

// Cleanup expired entries
await fileCache.cleanup();
```

### Cache Strategies

```typescript
// Cache expensive operations
async function analyzeComponent(filePath: string): Promise<ComponentInfo> {
  const cacheKey = `component:${filePath}`;
  
  // Check cache first
  let result = cache.get(cacheKey);
  if (result) {
    return result;
  }
  
  // Perform expensive analysis
  result = await performExpensiveAnalysis(filePath);
  
  // Cache result
  cache.set(cacheKey, result);
  
  return result;
}
```

## 📝 Logging (`PluginLogger`, `PerformanceTimer`)

Contextual logging with performance monitoring.

### Basic Logging

```typescript
// Create logger for your plugin
const logger = new PluginLogger('component-extractor');

// Log at different levels
logger.debug('Detailed debug information');
logger.info('General information');
logger.warn('Warning message');
logger.error('Error occurred', error);

// Log with context
logger.info('Processing file', { filePath, fileSize });
```

### Performance Monitoring

```typescript
// Performance timing
const timer = new PerformanceTimer();

timer.start('file-parsing');
const ast = await ASTUtils.parseFile(filePath);
const parseTime = timer.end('file-parsing');

timer.start('component-analysis');
const components = analyzeComponents(ast);
const analysisTime = timer.end('component-analysis');

logger.info('Performance metrics', {
  parseTime: `${parseTime}ms`,
  analysisTime: `${analysisTime}ms`
});
```

### Structured Logging

```typescript
// Log with structured data
logger.info('Analysis complete', {
  componentsFound: components.length,
  processingTime: timer.getTotalTime(),
  cacheHits: cache.getStats().hits,
  cacheMisses: cache.getStats().misses
});
```

## 🔧 Plugin Context

Standardized setup for all plugins.

### Creating Context

```typescript
// Quick setup for any plugin
const context = createPluginContext(
  '/project/path',          // Project root
  '/target/path',           // Optional target path
  'my-plugin-name'          // Plugin identifier
);

// Everything is ready to use
const { projectPath, targetPath, fileUtils, astUtils, logger, cache } = context;
```

### Context Interface

```typescript
interface CommonPluginContext {
  projectPath: string;
  targetPath?: string;
  fileUtils: typeof FileUtils;
  astUtils: typeof ASTUtils;
  patternUtils: typeof PatternUtils;
  pathUtils: typeof PathUtils;
  cache: PluginCache<string, any>;
  logger: PluginLogger;
}
```

### Standardized Results

```typescript
// Create consistent results
const result = createPluginResult(true, data, {
  processingTime: timer.getTotalTime(),
  filesProcessed: processedFiles.length,
  pluginVersion: '1.0.0',
  metadata: { customMetric: value }
});

// Result interface
interface CommonPluginResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
  warnings?: string[];
  metadata?: {
    processingTime: number;
    filesProcessed: number;
    pluginVersion: string;
    [key: string]: any;
  };
}
```

## ✅ Best Practices

### File Operations

```typescript
// ✅ Good: Always handle errors
try {
  const content = await FileUtils.readFile(filePath);
  // Process content
} catch (error) {
  logger.error('Failed to read file', { filePath, error: error.message });
  return createPluginResult(false, null, { errors: [error.message] });
}

// ✅ Good: Check file existence
if (await FileUtils.fileExists(filePath)) {
  const content = await FileUtils.readFile(filePath);
}

// ❌ Bad: Assume file exists
const content = await FileUtils.readFile(filePath); // May throw
```

### AST Processing

```typescript
// ✅ Good: Check AST validity
const ast = await ASTUtils.parseFile(filePath);
if (!ast) {
  logger.warn('Failed to parse file', { filePath });
  return null;
}

// ✅ Good: Handle parse errors gracefully
try {
  const ast = ASTUtils.parseCode(content, filePath);
  return analyzeAST(ast);
} catch (error) {
  logger.error('Parse error', { filePath, error: error.message });
  return null;
}
```

### Caching Strategy

```typescript
// ✅ Good: Use cache keys with file modification time
const stats = await FileUtils.getFileStats(filePath);
const cacheKey = `${filePath}:${stats.mtime.getTime()}`;

// ✅ Good: Implement cache warming
async function warmCache(files: string[]) {
  const promises = files.map(file => analyzeFileWithCache(file));
  await Promise.all(promises);
}
```

### Performance

```typescript
// ✅ Good: Monitor performance
const timer = new PerformanceTimer();
timer.start('total-analysis');

const results = await Promise.all(
  files.map(async file => {
    timer.start(`process-${file}`);
    const result = await processFile(file);
    timer.end(`process-${file}`);
    return result;
  })
);

const totalTime = timer.end('total-analysis');
logger.info('Analysis complete', { totalTime, filesProcessed: files.length });
```

### Error Handling

```typescript
// ✅ Good: Comprehensive error context
try {
  return await performAnalysis(filePath);
} catch (error) {
  const errorContext = {
    filePath,
    operation: 'analysis',
    timestamp: new Date().toISOString(),
    stack: error.stack
  };
  
  logger.error('Analysis failed', errorContext);
  
  return createPluginResult(false, null, {
    errors: [`Analysis failed for ${filePath}: ${error.message}`]
  });
}
```

## 📚 Examples

See the [examples directory](../examples/) for complete plugin implementations and usage patterns.
