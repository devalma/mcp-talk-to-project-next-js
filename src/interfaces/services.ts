/**
 * Service interfaces for dependency injection and service layer
 */

import type { ICache, IConfigProvider } from './core.js';

/**
 * File service interface for file system operations
 */
export interface IFileService {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  readDir(path: string): Promise<string[]>;
  stat(path: string): Promise<FileStats>;
  glob(pattern: string, options?: GlobOptions): Promise<string[]>;
  getRelativePath(from: string, to: string): string;
}

/**
 * AST service interface for code parsing
 */
export interface IASTService {
  parse(content: string, filePath: string): Promise<any>;
  traverse(ast: any, visitor: any): void;
  getNodeType(node: any): string;
  extractImports(ast: any): ImportInfo[];
  extractExports(ast: any): ExportInfo[];
}

/**
 * Analysis service interface for coordinating extractors
 */
export interface IAnalysisService {
  analyzeProject(projectPath: string): Promise<ProjectAnalysis>;
  analyzeFile(filePath: string): Promise<FileAnalysis>;
  analyzeDirectory(dirPath: string): Promise<DirectoryAnalysis>;
}

/**
 * Report service interface for generating reports
 */
export interface IReportService {
  generateReport(analysis: ProjectAnalysis, format: ReportFormat): Promise<string>;
  exportResults(data: any, format: ExportFormat, outputPath: string): Promise<void>;
  getAvailableTemplates(): ReportTemplate[];
}

/**
 * Plugin registry service interface
 */
export interface IPluginRegistry {
  register<T>(name: string, plugin: T): void;
  unregister(name: string): void;
  get<T>(name: string): T | undefined;
  getAll(): Map<string, any>;
  has(name: string): boolean;
}

/**
 * Logger service interface
 */
export interface ILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  setLevel(level: LogLevel): void;
  createChild(context: string): ILogger;
}

/**
 * Configuration service interface
 */
export interface IConfigService extends IConfigProvider<AppConfig> {
  loadFromFile(path: string): Promise<void>;
  saveToFile(path: string): Promise<void>;
  merge(config: Partial<AppConfig>): void;
  reset(): void;
}

/**
 * Cache service interface with specialized methods
 */
export interface ICacheService extends ICache<string, any> {
  getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T>;
  invalidatePattern(pattern: string): Promise<void>;
  getStats(): CacheStats;
}

// Supporting types
export interface FileStats {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  lastModified: Date;
  created: Date;
}

export interface GlobOptions {
  cwd?: string;
  ignore?: string[];
  absolute?: boolean;
  dot?: boolean;
}

export interface ImportInfo {
  source: string;
  imports: ImportSpecifier[];
  isDefault: boolean;
  isNamespace: boolean;
}

export interface ImportSpecifier {
  imported: string;
  local: string;
}

export interface ExportInfo {
  name: string;
  type: 'named' | 'default' | 'namespace';
  source?: string;
}

export interface ProjectAnalysis {
  projectPath: string;
  components: any[];
  hooks: any[];
  pages: any[];
  features: any[];
  dependencies: any[];
  metrics: ProjectMetrics;
  timestamp: Date;
}

export interface FileAnalysis {
  filePath: string;
  components: any[];
  hooks: any[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  metrics: FileMetrics;
}

export interface DirectoryAnalysis {
  dirPath: string;
  files: FileAnalysis[];
  subdirectories: DirectoryAnalysis[];
  summary: DirectorySummary;
}

export interface ProjectMetrics {
  totalFiles: number;
  totalComponents: number;
  totalHooks: number;
  totalPages: number;
  codeComplexity: number;
  maintainabilityIndex: number;
}

export interface FileMetrics {
  linesOfCode: number;
  complexity: number;
  components: number;
  hooks: number;
  dependencies: number;
}

export interface DirectorySummary {
  totalFiles: number;
  fileTypes: Record<string, number>;
  averageFileSize: number;
  largestFile: string;
}

export type ReportFormat = 'json' | 'yaml' | 'markdown' | 'html' | 'pdf';
export type ExportFormat = 'json' | 'csv' | 'excel' | 'yaml';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ReportTemplate {
  name: string;
  description: string;
  format: ReportFormat;
  sections: string[];
}

export interface AppConfig {
  extractors: ExtractorConfig;
  output: OutputConfig;
  analysis: AnalysisConfig;
  logging: LoggingConfig;
}

export interface ExtractorConfig {
  components: ComponentExtractorConfig;
  hooks: HookExtractorConfig;
  pages: PageExtractorConfig;
  features: FeatureExtractorConfig;
}

export interface ComponentExtractorConfig {
  includeProps: boolean;
  includeHooks: boolean;
  includeTests: boolean;
  excludePatterns: string[];
}

export interface HookExtractorConfig {
  includeBuiltin: boolean;
  includeCustom: boolean;
  trackDependencies: boolean;
}

export interface PageExtractorConfig {
  includeMetadata: boolean;
  includeRoutes: boolean;
  detectRouterType: boolean;
}

export interface FeatureExtractorConfig {
  autoDetect: boolean;
  patterns: string[];
  includeShared: boolean;
}

export interface OutputConfig {
  format: ReportFormat;
  pretty: boolean;
  includeMetadata: boolean;
  template?: string;
}

export interface AnalysisConfig {
  parallel: boolean;
  maxConcurrency: number;
  cacheEnabled: boolean;
  cacheTTL: number;
}

export interface LoggingConfig {
  level: LogLevel;
  format: 'text' | 'json';
  output: 'console' | 'file';
  filePath?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}
