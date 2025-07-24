# Enhanced API Reference

Complete API documentation for the Next.js Project Analyzer MCP Server, including enhanced analysis tools, flexible modes, and comprehensive formatting options.

## 📋 Table of Contents

- [Enhanced MCP Tools](#enhanced-mcp-tools)
- [Analysis Modes](#analysis-modes)
- [Pattern Matching](#pattern-matching)
- [Output Formats](#output-formats)
- [Plugin Interfaces](#plugin-interfaces)
- [Common Utilities API](#common-utilities-api)
- [Type Definitions](#type-definitions)
- [Error Handling](#error-handling)

## 🔧 Enhanced MCP Tools

All tools support three analysis modes (`all`, `specific`, `detailed`) and multiple output formats (`text`, `markdown`, `json`).

### `analyze_components`

Comprehensive React component analysis with flexible targeting and detailed insights.

**Input Schema:**
```typescript
{
  path?: string;                    // Directory/file path (relative to project root)
  format?: 'text' | 'markdown' | 'json';  // Output format (default: 'text')
  mode?: 'all' | 'specific' | 'detailed'; // Analysis depth (default: 'all')
  componentPattern?: string;         // Pattern for specific targeting (e.g., 'Button', '*Modal', 'Auth*')
  includeProps?: boolean;           // Include props information (default: false)
  includeHooks?: boolean;           // Include hooks usage (default: false)
}
```

**Mode Behaviors:**
- **`all`**: Lists all components with basic metadata (name, type, file, exports)
- **`specific`**: Filters components matching `componentPattern` using glob-style patterns
- **`detailed`**: Comprehensive analysis including props, hooks, dependencies, complexity metrics

**Returns:**
```typescript
{
  content: [{
    type: 'text',
    text: string;  // Formatted according to specified format
  }];
  isError?: boolean;
}
```

**Example Patterns:**
- `"Button"` - Exact match for Button component
- `"*Button*"` - Any component containing "Button"
- `"Auth*"` - Components starting with "Auth"
- `"*Modal"` - Components ending with "Modal"

---

### `analyze_hooks`

React hooks analysis with custom/built-in filtering and usage insights.

**Input Schema:**
```typescript
{
  path?: string;                    // Directory/file path (relative to project root)
  format?: 'text' | 'markdown' | 'json';  // Output format (default: 'text')
  mode?: 'all' | 'specific' | 'detailed'; // Analysis depth (default: 'all')
  hookPattern?: string;             // Pattern for specific targeting (e.g., 'useState', 'use*')
  includeBuiltIn?: boolean;         // Include React built-in hooks (default: true)
  includeCustom?: boolean;          // Include custom hooks (default: true)
}
```

**Mode Behaviors:**
- **`all`**: Lists all hooks with basic usage information
- **`specific`**: Filters hooks matching `hookPattern`
- **`detailed`**: Comprehensive analysis including dependencies, parameters, return values

**Hook Pattern Examples:**
- `"useState"` - Specific React hook
- `"use*"` - All custom hooks (typically start with "use")
- `"*Auth*"` - Hooks containing "Auth" in name
- `"useEffect"` - Specific built-in hook analysis

---

### `analyze_pages`

Next.js pages and routing analysis with API route support.

**Input Schema:**
```typescript
{
  path?: string;                    // Pages directory path (auto-detects pages/app)
  format?: 'text' | 'markdown' | 'json';  // Output format (default: 'text')
  mode?: 'all' | 'specific' | 'detailed'; // Analysis depth (default: 'all')
  pagePattern?: string;             // Pattern for specific targeting (e.g., 'api/*', '[slug]')
  includeApiRoutes?: boolean;       // Include API routes (default: true)
}
```

**Mode Behaviors:**
- **`all`**: Lists all pages and routes with basic routing info
- **`specific`**: Filters pages matching `pagePattern`
- **`detailed`**: Comprehensive analysis including data fetching methods, dynamic params

**Page Pattern Examples:**
- `"api/*"` - All API routes
- `"[slug]"` - Dynamic slug routes
- `"blog/*"` - All blog-related pages
- `"index"` - Index pages only

---

### `analyze_features`

Project feature and module organization analysis.

**Input Schema:**
```typescript
{
  path?: string;                    // Source directory path (default: 'src')
  format?: 'text' | 'markdown' | 'json';  // Output format (default: 'text')
  mode?: 'all' | 'specific' | 'detailed'; // Analysis depth (default: 'all')
  featurePattern?: string;          // Pattern for specific targeting (e.g., 'auth', '*admin*')
  includeTypes?: boolean;           // Include TypeScript types (default: false)
}
```

**Mode Behaviors:**
- **`all`**: Lists all features with basic module structure
- **`specific`**: Filters features matching `featurePattern`
- **`detailed`**: Comprehensive analysis including module dependencies, shared components

**Feature Pattern Examples:**
- `"auth"` - Authentication-related features
- `"*admin*"` - Admin panel features
- `"user*"` - User management features
- `"*api*"` - API-related modules

---

### `analyze_patterns`

React and Next.js architectural pattern detection and analysis.

**Input Schema:**
```typescript
{
  path?: string;                    // Directory path to analyze
  format?: 'text' | 'markdown' | 'json';  // Output format (default: 'text')
  mode?: 'all' | 'specific' | 'detailed'; // Analysis depth (default: 'all')
  patternType?: 'hooks' | 'context' | 'hoc' | 'render-props' | 'all'; // Pattern category
  patternPattern?: string;          // Pattern for specific targeting
}
```

**Mode Behaviors:**
- **`all`**: Lists all detected patterns across categories
- **`specific`**: Filters patterns by type or name pattern
- **`detailed`**: Comprehensive analysis including implementation details, usage recommendations

**Pattern Examples:**
- `patternType: "context"` - React Context patterns only
- `patternPattern: "with*"` - HOCs starting with "with"
- `patternPattern: "*Provider"` - Context providers

---

### `get_project_overview`

Comprehensive project information and statistics.

**Input Schema:**
```typescript
{
  format?: 'text' | 'markdown' | 'json';  // Output format (default: 'text')
}
```

**Provides:**
- Project structure and technology stack
- Component, hook, page, and feature counts
- Dependency analysis
- Configuration overview
- Framework version information

---

### `get_help`

Help documentation and usage examples.

**Input Schema:**
```typescript
{
  format?: 'text' | 'markdown' | 'json';  // Output format (default: 'text')
  command?: string;                 // Specific command help (optional)
}
```

## 🎯 Analysis Modes

### **All Mode** (`mode: "all"`)
- **Purpose**: Quick overview and basic listing
- **Use Case**: Initial project exploration, getting familiar with codebase
- **Performance**: Fastest, minimal processing
- **Output**: Concise summaries with essential information

### **Specific Mode** (`mode: "specific"`)
- **Purpose**: Targeted analysis using pattern matching
- **Use Case**: Finding specific components, debugging particular features
- **Performance**: Moderate, filters during processing
- **Output**: Focused results matching specified patterns

### **Detailed Mode** (`mode: "detailed"`)
- **Purpose**: Comprehensive analysis with full insights
- **Use Case**: Code reviews, architecture analysis, refactoring planning
- **Performance**: Thorough, maximum processing time
- **Output**: Extensive details including dependencies, metrics, recommendations

## 🔍 Pattern Matching

All tools support glob-style pattern matching for flexible filtering:

### **Pattern Syntax**
- `*` - Matches any characters
- `?` - Matches single character
- `[abc]` - Matches any character in brackets
- `**` - Matches any directory depth (for paths)

### **Common Patterns**
```typescript
// Component patterns
"Button"           // Exact match
"*Button*"         // Contains "Button"
"Auth*"            // Starts with "Auth"
"*Modal"           // Ends with "Modal"

// Page patterns  
"api/*"            // All API routes
"[*]"              // All dynamic routes
"blog/**"          // All blog pages (nested)

// Hook patterns
"use*"             // All custom hooks
"*Auth*"           // Auth-related hooks
"useState"         // Specific React hook

// Feature patterns
"auth"             // Exact feature match
"*admin*"          // Admin-related features
"user*"            // User management features
```

## 📄 Output Formats

### **Text Format** (`format: "text"`)
- Human-readable plain text
- Structured with headers and bullet points
- Ideal for quick reading and console output

### **Markdown Format** (`format: "markdown"`)
- Structured markdown with headers, lists, code blocks
- Perfect for documentation and reports
- Compatible with GitHub, documentation sites

### **JSON Format** (`format: "json"`)
- Machine-readable structured data
- Ideal for programmatic processing
- Preserves all extracted metadata and relationships
  };
}
```

**Example:**
```typescript
// Via MCP client
const result = await mcpClient.callTool('analyze_components', {
  projectPath: '/Users/dev/my-react-app',
  targetPath: 'src/components',
  config: {
    includeTests: false,
    maxComplexity: 10
  }
});
```

### `analyze_hooks`

Analyzes React hooks usage patterns in a project.

**Parameters:**
```typescript
{
  projectPath: string;
  targetPath?: string;
  config?: {
    trackCustomHooks?: boolean;    // Track custom hooks (default: true)
    analyzePerformance?: boolean;  // Performance analysis (default: true)
    checkBestPractices?: boolean;  // Best practices check (default: true)
  }
}
```

**Returns:**
```typescript
{
  success: boolean;
  data?: {
    hooks: HookInfo[];
    customHooks: CustomHookInfo[];
    usage: HookUsageStatistics;
    violations?: BestPracticeViolation[];
  };
}
```

### `analyze_pages`

Analyzes Next.js pages structure and routing.

**Parameters:**
```typescript
{
  projectPath: string;
  config?: {
    analyzeRouting?: boolean;      // Analyze routing patterns (default: true)
    checkSEO?: boolean;           // SEO analysis (default: true)
    analyzePerformance?: boolean; // Performance analysis (default: true)
  }
}
```

**Returns:**
```typescript
{
  success: boolean;
  data?: {
    pages: PageInfo[];
    routing: RoutingAnalysis;
    seo?: SEOAnalysis;
    performance?: PagePerformanceAnalysis;
  };
}
```

### `analyze_dependencies`

Maps import/export relationships and dependency usage.

**Parameters:**
```typescript
{
  projectPath: string;
  targetPath?: string;
  config?: {
    includeNodeModules?: boolean;  // Include external deps (default: false)
    detectCircular?: boolean;      // Detect circular deps (default: true)
    groupByType?: boolean;         // Group by dependency type (default: true)
  }
}
```

**Returns:**
```typescript
{
  success: boolean;
  data?: {
    dependencies: DependencyInfo[];
    graph: DependencyGraph;
    circular?: CircularDependency[];
    external: ExternalDependency[];
    statistics: DependencyStatistics;
  };
}
```

### `get_project_summary`

Generates a comprehensive project overview.

**Parameters:**
```typescript
{
  projectPath: string;
  config?: {
    includeMetrics?: boolean;      // Include code metrics (default: true)
    analyzeTech?: boolean;         // Technology analysis (default: true)
    generateRecommendations?: boolean; // Generate recommendations (default: true)
  }
}
```

**Returns:**
```typescript
{
  success: boolean;
  data?: {
    overview: ProjectOverview;
    technology: TechnologyStack;
    metrics: ProjectMetrics;
    recommendations?: string[];
    insights?: ProjectInsights;
  };
}
```

### `analyze_file`

Performs detailed analysis of a single file.

**Parameters:**
```typescript
{
  filePath: string;              // Absolute path to file
  config?: {
    extractComponents?: boolean;   // Extract components (default: true)
    extractHooks?: boolean;       // Extract hooks (default: true)
    calculateMetrics?: boolean;   // Calculate metrics (default: true)
    analyzeImports?: boolean;     // Analyze imports (default: true)
  }
}
```

**Returns:**
```typescript
{
  success: boolean;
  data?: {
    file: FileInfo;
    components?: ComponentInfo[];
    hooks?: HookInfo[];
    imports?: ImportInfo[];
    exports?: ExportInfo[];
    metrics?: FileMetrics;
  };
}
```

### `search_code`

Searches for patterns in the codebase.

**Parameters:**
```typescript
{
  projectPath: string;
  pattern: string;               // Search pattern (regex or string)
  config?: {
    caseSensitive?: boolean;     // Case sensitive search (default: false)
    wholeWords?: boolean;        // Match whole words only (default: false)
    includeFiles?: string[];     // File patterns to include
    excludeFiles?: string[];     // File patterns to exclude
    maxResults?: number;         // Max results (default: 100)
  }
}
```

**Returns:**
```typescript
{
  success: boolean;
  data?: {
    matches: SearchMatch[];
    summary: SearchSummary;
  };
}
```

### `get_metrics`

Calculates comprehensive code quality metrics.

**Parameters:**
```typescript
{
  projectPath: string;
  targetPath?: string;
  config?: {
    includeComplexity?: boolean;   // Complexity metrics (default: true)
    includeMaintainability?: boolean; // Maintainability index (default: true)
    includeTestCoverage?: boolean; // Test coverage (default: false)
  }
}
```

**Returns:**
```typescript
{
  success: boolean;
  data?: {
    metrics: CodeMetrics;
    scores: QualityScores;
    recommendations?: string[];
  };
}
```

## 🔌 Plugin Interfaces

### Core Plugin Interface

```typescript
interface IPlugin {
  name: string;
  version: string;
  description: string;
  analyze(context: PluginContext): Promise<PluginResult>;
}

interface PluginContext {
  projectPath: string;
  targetPath?: string;
  config?: any;
  services: ServiceContainer;
}

interface PluginResult<T = any> {
  success: boolean;
  data?: T;
  errors?: string[];
  warnings?: string[];
  metadata?: PluginMetadata;
}

interface PluginMetadata {
  processingTime: number;
  filesProcessed: number;
  pluginVersion: string;
  cacheHits?: number;
  cacheMisses?: number;
  [key: string]: any;
}
```

### Extractor Interface

```typescript
interface IExtractor<T> {
  extract(filePath: string, context: PluginContext): Promise<T | null>;
}

interface IFileProcessor {
  processFile(filePath: string, context: PluginContext): Promise<ProcessingResult>;
  canProcess(filePath: string): boolean;
  getSupportedExtensions(): string[];
}

interface ProcessingResult {
  filePath: string;
  processed: boolean;
  data?: any;
  errors?: string[];
  warnings?: string[];
}
```

### Processor Interface

```typescript
interface IProcessor<TInput, TOutput> {
  process(data: TInput[], context: PluginContext): Promise<TOutput>;
}

interface IDataAggregator<T> {
  aggregate(data: T[]): T;
  merge(existing: T, incoming: T): T;
}
```

### Formatter Interface

```typescript
interface IFormatter<T> {
  format(data: T, format: OutputFormat): string;
  getSupportedFormats(): OutputFormat[];
}

type OutputFormat = 'json' | 'yaml' | 'markdown' | 'csv' | 'html';
```

### Cache Interface

```typescript
interface ICache<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V, ttl?: number): void;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;
  size(): number;
}

interface IPersistentCache<K, V> extends ICache<K, V> {
  load(): Promise<void>;
  save(): Promise<void>;
  cleanup(): Promise<void>;
}
```

### Logger Interface

```typescript
interface ILogger {
  debug(message: string, context?: any): void;
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, context?: any): void;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
```

## 🛠️ Common Utilities API

### FileUtils

```typescript
class FileUtils {
  // File reading
  static async readFile(filePath: string, defaultContent?: string): Promise<string>;
  static async readFileLines(filePath: string): Promise<string[]>;
  
  // File writing
  static async writeFile(filePath: string, content: string): Promise<void>;
  static async appendToFile(filePath: string, content: string): Promise<void>;
  
  // File system operations
  static async fileExists(filePath: string): Promise<boolean>;
  static isDirectory(path: string): boolean;
  static async getFileStats(filePath: string): Promise<FileStats>;
  
  // Directory operations
  static async ensureDirectoryExists(dirPath: string): Promise<void>;
  static async listFiles(dirPath: string): Promise<string[]>;
  static async listFilesRecursive(dirPath: string): Promise<string[]>;
  
  // File utilities
  static getFileExtension(filename: string): string;
  static getBaseName(filename: string): string;
  static async createTempFile(prefix: string, content: string): Promise<string>;
  
  // Copy operations
  static async copyFile(sourcePath: string, destPath: string): Promise<void>;
  static async copyDirectory(sourceDir: string, destDir: string): Promise<void>;
}

interface FileStats {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  mtime: Date;
  ctime: Date;
}
```

### ASTUtils

```typescript
class ASTUtils {
  // Parsing
  static async parseFile(filePath: string): Promise<any | null>;
  static parseCode(code: string, filePath?: string): any;
  static parseCodeWithOptions(code: string, options: ParseOptions): any;
  
  // Traversal
  static traverse(ast: any, visitor: TraversalVisitor): void;
  
  // Information extraction
  static findImports(ast: any): ImportInfo[];
  static findExports(ast: any): ExportInfo[];
  static findFunctionCalls(ast: any, functionName?: string): FunctionCall[];
  static extractReactComponents(ast: any): ComponentInfo[];
  static extractHooks(ast: any): HookInfo[];
  
  // Analysis
  static containsJSX(nodePath: any): boolean;
  static calculateComplexity(nodePath: any): number;
  static getNodeType(node: any): string;
  static getSourceLocation(node: any): SourceLocation;
}

interface ParseOptions {
  sourceType?: 'module' | 'script';
  allowImportExportEverywhere?: boolean;
  allowReturnOutsideFunction?: boolean;
  plugins?: string[];
}

interface TraversalVisitor {
  [nodeType: string]: (path: any) => void;
}

interface SourceLocation {
  start: { line: number; column: number };
  end: { line: number; column: number };
}
```

### PatternUtils

```typescript
class PatternUtils {
  // Pattern matching
  static matchesPattern(filePath: string, pattern: string): boolean;
  static matchesAnyPattern(filePath: string, patterns: string[]): boolean;
  
  // File finding
  static async findFiles(rootPath: string, patterns: string[]): Promise<string[]>;
  static async findFilesWithOptions(
    rootPath: string, 
    options: FindOptions
  ): Promise<string[]>;
  
  // Filtering
  static filterByPatterns(
    files: string[], 
    options: FilterOptions
  ): string[];
  
  // Pattern validation
  static isValidGlobPattern(pattern: string): boolean;
  static normalizePattern(pattern: string): string;
}

class PathUtils {
  static isInDirectory(filePath: string, directoryPath: string): boolean;
  static getRelativePath(from: string, to: string): string;
  static normalizeToUnix(path: string): string;
  static getPathDepth(path: string): number;
  static getParentDirectory(path: string): string;
}

interface FindOptions {
  include?: string[];
  exclude?: string[];
  maxDepth?: number;
  followSymlinks?: boolean;
  ignoreCase?: boolean;
}

interface FilterOptions {
  include?: string[];
  exclude?: string[];
}
```

### PluginCache

```typescript
class PluginCache<K, V> implements ICache<K, V> {
  constructor(defaultTTL?: number);
  
  get(key: K): V | undefined;
  set(key: K, value: V, ttl?: number): void;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;
  size(): number;
  
  // Statistics
  getStats(): CacheStats;
  resetStats(): void;
}

class FileCache<K, V> implements IPersistentCache<K, V> {
  constructor(cacheDir: string, defaultTTL?: number);
  
  // All ICache methods plus:
  async load(): Promise<void>;
  async save(): Promise<void>;
  async cleanup(): Promise<void>;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}
```

### PluginLogger

```typescript
class PluginLogger implements ILogger {
  constructor(context: string, level?: LogLevel);
  
  debug(message: string, context?: any): void;
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, context?: any): void;
  
  // Context management
  setContext(context: string): void;
  setLevel(level: LogLevel): void;
  
  // Performance timing
  time(label: string): void;
  timeEnd(label: string): number;
}

class PerformanceTimer {
  start(label: string): void;
  end(label: string): number;
  getTotalTime(): number;
  getTimings(): Record<string, number>;
  reset(): void;
}
```

## 📊 Type Definitions

### Component Types

```typescript
interface ComponentInfo {
  name: string;
  filePath: string;
  type: 'functional' | 'class';
  isDefaultExport: boolean;
  isNamedExport: boolean;
  
  props: PropInfo[];
  hooks: HookInfo[];
  
  complexity: number;
  linesOfCode: number;
  jsxElements: number;
  
  imports: ImportInfo[];
  exports: ExportInfo[];
  
  hasTypeScript: boolean;
  hasPropTypes: boolean;
  hasDefaultProps: boolean;
  isForwardRef: boolean;
  isMemoized: boolean;
}

interface PropInfo {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

interface HookInfo {
  name: string;
  type: 'builtin' | 'custom';
  usageCount: number;
  dependencies?: string[];
  line: number;
}
```

### Import/Export Types

```typescript
interface ImportInfo {
  source: string;
  imports: ImportSpecifier[];
  isDefault: boolean;
  isNamespace: boolean;
  line?: number;
}

interface ImportSpecifier {
  imported: string;
  local: string;
}

interface ExportInfo {
  name: string;
  type: 'named' | 'default' | 'namespace';
  source?: string;
  line?: number;
}
```

### Analysis Types

```typescript
interface ComponentSummary {
  totalComponents: number;
  functionalComponents: number;
  classComponents: number;
  
  averageComplexity: number;
  maxComplexity: number;
  complexComponents: number;
  
  averagePropsCount: number;
  maxPropsCount: number;
  
  hooksUsage: Record<string, number>;
  customHooksCount: number;
  
  typeScriptComponents: number;
  memoizedComponents: number;
}

interface ProjectMetrics {
  linesOfCode: number;
  files: number;
  components: number;
  hooks: number;
  
  complexity: {
    average: number;
    median: number;
    max: number;
    distribution: number[];
  };
  
  maintainability: {
    index: number;
    score: 'A' | 'B' | 'C' | 'D' | 'F';
  };
  
  testCoverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
}
```

### Search Types

```typescript
interface SearchMatch {
  filePath: string;
  line: number;
  column: number;
  match: string;
  context: string;
}

interface SearchSummary {
  totalMatches: number;
  filesWithMatches: number;
  searchPattern: string;
  executionTime: number;
}
```

## ❌ Error Codes

### Plugin Errors

```typescript
enum PluginErrorCode {
  PLUGIN_NOT_FOUND = 'PLUGIN_NOT_FOUND',
  PLUGIN_LOAD_FAILED = 'PLUGIN_LOAD_FAILED',
  PLUGIN_EXECUTION_FAILED = 'PLUGIN_EXECUTION_FAILED',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  UNSUPPORTED_FILE_TYPE = 'UNSUPPORTED_FILE_TYPE'
}
```

### File System Errors

```typescript
enum FileSystemErrorCode {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  ACCESS_DENIED = 'ACCESS_DENIED',
  DIRECTORY_NOT_FOUND = 'DIRECTORY_NOT_FOUND',
  INVALID_PATH = 'INVALID_PATH',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE'
}
```

### Parse Errors

```typescript
enum ParseErrorCode {
  SYNTAX_ERROR = 'SYNTAX_ERROR',
  UNSUPPORTED_SYNTAX = 'UNSUPPORTED_SYNTAX',
  INVALID_TYPESCRIPT = 'INVALID_TYPESCRIPT',
  INVALID_JSX = 'INVALID_JSX'
}
```

### Error Response Format

```typescript
interface ErrorResponse {
  success: false;
  errors: ErrorInfo[];
  metadata?: {
    processingTime: number;
    timestamp: string;
  };
}

interface ErrorInfo {
  code: string;
  message: string;
  filePath?: string;
  line?: number;
  column?: number;
  stack?: string;
}
```

## ⚙️ Configuration Schema

### Global Configuration

```typescript
interface GlobalConfig {
  // Logging configuration
  logging: {
    level: LogLevel;
    outputFile?: string;
    enableConsole: boolean;
    enableFile: boolean;
  };
  
  // Cache configuration
  cache: {
    enabled: boolean;
    directory: string;
    defaultTTL: number;
    maxSize: number;
  };
  
  // Performance configuration
  performance: {
    maxFileSize: number;
    maxFiles: number;
    timeoutMs: number;
    concurrency: number;
  };
  
  // Plugin configuration
  plugins: Record<string, PluginConfig>;
}

interface PluginConfig {
  enabled: boolean;
  priority: number;
  config: any;
}
```

### File Pattern Configuration

```typescript
interface PatternConfig {
  include: string[];
  exclude: string[];
  extensions: string[];
  ignoreCase: boolean;
  followSymlinks: boolean;
  maxDepth: number;
}
```

### Output Configuration

```typescript
interface OutputConfig {
  format: OutputFormat;
  pretty: boolean;
  includeMetadata: boolean;
  includeWarnings: boolean;
  compression: boolean;
}
```

## 🔗 Usage Examples

### Using MCP Client

```typescript
import { MCPClient } from '@modelcontextprotocol/client';

const client = new MCPClient();

// Analyze components
const result = await client.callTool('analyze_components', {
  projectPath: '/path/to/project',
  config: {
    includeTests: true,
    maxComplexity: 10
  }
});

if (result.success) {
  console.log(`Found ${result.data.components.length} components`);
}
```

### Direct Plugin Usage

```typescript
import { ComponentExtractorPlugin } from './plugins/component-extractor/index.js';
import { createPluginContext } from './plugins/common/index.js';

const plugin = new ComponentExtractorPlugin();
const context = createPluginContext('/project/path', undefined, 'test');

const result = await plugin.analyze(context);
```

### Custom Plugin Implementation

```typescript
import { IPlugin, PluginContext, PluginResult } from './interfaces/index.js';

class MyCustomPlugin implements IPlugin {
  name = 'my-custom-plugin';
  version = '1.0.0';
  description = 'Custom analysis plugin';
  
  async analyze(context: PluginContext): Promise<PluginResult> {
    // Implementation
    return {
      success: true,
      data: { /* analysis results */ },
      metadata: {
        processingTime: 100,
        filesProcessed: 5,
        pluginVersion: this.version
      }
    };
  }
}
```

This API reference provides the complete interface for working with the MCP Talk to Project system. For more examples and usage patterns, see the [examples directory](./examples/) and [plugin development guide](./plugin-development.md).
