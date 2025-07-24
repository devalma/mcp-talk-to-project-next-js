/**
 * Core interfaces for the plugin system
 */

/**
 * Base extractor interface - all extractors must implement this
 */
export interface IExtractor<TInput, TOutput> {
  extract(input: TInput): Promise<TOutput>;
  shouldProcess(filePath: string): boolean;
  getMetadata(): ExtractorMetadata;
}

/**
 * File processor interface for handling different file types
 */
export interface IFileProcessor {
  canProcess(filePath: string): boolean;
  parse(filePath: string): Promise<any>;
  getFileInfo(filePath: string): FileInfo;
}

/**
 * Result formatter interface for standardizing output
 */
export interface IResultFormatter<TData> {
  format(data: TData, options?: FormatOptions): FormattedResult;
  getSupportedFormats(): string[];
}

/**
 * Validator interface for data validation
 */
export interface IValidator<TData> {
  validate(data: TData): ValidationResult;
  getSchema(): any;
}

/**
 * Cache interface for performance optimization
 */
export interface ICache<TKey, TValue> {
  get(key: TKey): Promise<TValue | undefined>;
  set(key: TKey, value: TValue, ttl?: number): Promise<void>;
  has(key: TKey): Promise<boolean>;
  clear(): Promise<void>;
  delete(key: TKey): Promise<boolean>;
}

/**
 * Filter strategy interface for file/content filtering
 */
export interface IFilterStrategy {
  shouldInclude(filePath: string, content?: string): boolean;
  getFilterCriteria(): FilterCriteria;
}

/**
 * Plugin lifecycle interface
 */
export interface IPluginLifecycle {
  initialize(): Promise<void>;
  beforeProcess(): Promise<void>;
  afterProcess(): Promise<void>;
  cleanup(): Promise<void>;
}

/**
 * Configuration provider interface
 */
export interface IConfigProvider<TConfig> {
  getConfig(): TConfig;
  validateConfig(config: TConfig): boolean;
  updateConfig(config: Partial<TConfig>): void;
}

// Supporting types
export interface ExtractorMetadata {
  name: string;
  version: string;
  description: string;
  supportedFileTypes: string[];
  dependencies?: string[];
  cli?: CLIMetadata;
}

export interface CLIMetadata {
  command: string;
  description: string;
  usage?: string;
  options?: CLIOption[];
  examples?: string[];
  category?: string;
}

export interface CLIOption {
  name: string;
  description: string;
  type: 'boolean' | 'string' | 'number';
  default?: any;
  required?: boolean;
}

export interface FileInfo {
  path: string;
  size: number;
  extension: string;
  lastModified: Date;
  isDirectory: boolean;
}

export interface FormatOptions {
  format: 'json' | 'yaml' | 'markdown' | 'html';
  pretty?: boolean;
  includeMetadata?: boolean;
}

export interface FormattedResult {
  content: string;
  mimeType: string;
  size: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

export interface FilterCriteria {
  includePatterns: string[];
  excludePatterns: string[];
  fileTypes: string[];
  minSize?: number;
  maxSize?: number;
}
