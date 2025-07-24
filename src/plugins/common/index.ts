/**
 * Common Plugin Utilities - Available to all plugins
 * 
 * This provides a standardized set of utilities that all plugins can use,
 * ensuring consistency and reducing code duplication.
 */

// Base extractor class
export { BaseExtractor } from './base-extractor.js';
export type { ExtractorConfig } from './base-extractor.js';

// File system utilities
export { FileUtils } from './file-utils.js';

// AST parsing utilities  
export { ASTUtils } from './ast-utils.js';
export type { ImportInfo, ImportSpecifier, ExportInfo, FunctionCall } from './ast-utils.js';

// Specialized AST utilities
export { ReactComponentUtils } from './react-component-utils.js';
export type { ComponentInfo } from './react-component-utils.js';

export { ReactHooksUtils } from './react-hooks-utils.js';
export type { HookInfo, HookUsageInfo } from './react-hooks-utils.js';

export { NextJSUtils } from './nextjs-utils.js';
export type { NextJSPageInfo, NextJSApiInfo } from './nextjs-utils.js';

export { ReactContextUtils } from './react-context-utils.js';
export type { ContextInfo, ContextUsageInfo } from './react-context-utils.js';

// Pattern matching utilities
export { PatternUtils, PathUtils } from './pattern-utils.js';

// Caching utilities
export { PluginCache, FileCache } from './cache-utils.js';

// Logging utilities
export { PluginLogger, PerformanceTimer } from './logger.js';
export type { LogLevel } from './logger.js';

// Import for type definitions
import { FileUtils } from './file-utils.js';
import { ASTUtils } from './ast-utils.js';
import { PatternUtils, PathUtils } from './pattern-utils.js';
import { PluginCache } from './cache-utils.js';
import { PluginLogger, type LogLevel } from './logger.js';

/**
 * Common plugin base context that provides all shared utilities
 */
export interface CommonPluginContext {
  projectPath: string;
  targetPath?: string;
  fileUtils: typeof FileUtils;
  astUtils: typeof ASTUtils;
  patternUtils: typeof PatternUtils;
  pathUtils: typeof PathUtils;
  cache: PluginCache<string, any>;
  logger: PluginLogger;
}

/**
 * Create a standardized plugin context with all common utilities
 */
export function createPluginContext(
  projectPath: string,
  targetPath?: string,
  pluginName: string = 'unknown-plugin'
): CommonPluginContext {
  const cache = new PluginCache<string, any>();
  const logger = new PluginLogger(pluginName);
  
  return {
    projectPath,
    targetPath,
    fileUtils: FileUtils,
    astUtils: ASTUtils,
    patternUtils: PatternUtils,
    pathUtils: PathUtils,
    cache,
    logger
  };
}

/**
 * Standardized plugin result format
 */
export interface PluginResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    filesProcessed: number;
    processingTimeMs: number;
    cacheHits?: number;
    cacheMisses?: number;
  };
}

/**
 * Factory function to create common plugin context
 */
export function createCommonContext(
  projectPath: string, 
  targetPath?: string,
  pluginName?: string
): CommonPluginContext {
  return {
    projectPath,
    targetPath,
    fileUtils: FileUtils,
    astUtils: ASTUtils,
    patternUtils: PatternUtils,
    pathUtils: PathUtils,
    cache: new PluginCache(),
    logger: new PluginLogger(pluginName || 'plugin')
  };
}

/**
 * Common configuration options that all plugins can extend
 */
export interface CommonPluginConfig {
  enabled?: boolean;
  priority?: number;
  logLevel?: LogLevel;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFileSize?: number;
  strict?: boolean;
}

/**
 * Common result format that all plugins should use
 */
export interface CommonPluginResult<TData = any> {
  success: boolean;
  data?: TData;
  errors?: string[];
  warnings?: string[];
  metadata?: {
    processingTime: number;
    filesProcessed: number;
    pluginVersion: string;
    [key: string]: any;
  };
}

/**
 * Utility to create standardized plugin results
 */
export function createPluginResult<TData>(
  success: boolean,
  data?: TData,
  options: {
    errors?: string[];
    warnings?: string[];
    processingTime?: number;
    filesProcessed?: number;
    pluginVersion?: string;
    metadata?: Record<string, any>;
  } = {}
): CommonPluginResult<TData> {
  return {
    success,
    data,
    errors: options.errors?.length ? options.errors : undefined,
    warnings: options.warnings?.length ? options.warnings : undefined,
    metadata: {
      processingTime: options.processingTime || 0,
      filesProcessed: options.filesProcessed || 0,
      pluginVersion: options.pluginVersion || '1.0.0',
      ...options.metadata
    }
  };
}
