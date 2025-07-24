/**
 * Enhanced Base Extractor Class
 * 
 * Provides common patterns for file-based extraction plugins,
 * eliminating code duplication across extractors.
 */

import { BasePlugin } from '../base.js';
import type { PluginResult, PluginContext } from '../../types/plugin.js';
import type { CommonPluginResult } from './index.js';
import { FileUtils } from './file-utils.js';
import { ASTUtils } from './ast-utils.js';
import { PluginLogger } from './logger.js';
import path from 'path';

export interface ExtractorConfig {
  enabled?: boolean;
  priority?: number;
  filePatterns?: string[];
  excludePatterns?: string[];
  maxFileSize?: number;
  batchSize?: number;
  parallel?: boolean;
  includeNodeModules?: boolean;
}

/**
 * Base class for file-based extractors that provides common functionality
 */
export abstract class BaseExtractor<TFileResult = any, TFinalResult = any> extends BasePlugin {
  protected logger!: PluginLogger;
  protected extractorConfig: ExtractorConfig;
  private timers: Map<string, number> = new Map();

  constructor(config: ExtractorConfig = {}) {
    super(config);
    this.extractorConfig = {
      filePatterns: ['**/*.{js,jsx,ts,tsx}'],
      excludePatterns: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
      maxFileSize: 1024 * 1024, // 1MB
      batchSize: 10,
      parallel: true,
      includeNodeModules: false,
      ...config
    };
  }

  /**
   * Initialize the plugin with context
   */
  init(context: PluginContext): void {
    super.init(context);
    this.logger = new PluginLogger(this.metadata.name);
  }

  /**
   * Main extraction method - handles the common file processing pipeline
   */
  async extract(targetPath: string): Promise<PluginResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Starting extraction for: ${targetPath}`);

      // Step 1: Discover files to process
      const files = await this.discoverFiles(targetPath);
      this.logger.info(`Found ${files.length} files to process`);

      // Step 2: Filter files based on configuration
      const filteredFiles = await this.filterFiles(files);
      this.logger.info(`Processing ${filteredFiles.length} files after filtering`);

      // Step 3: Process files (with batching/parallel support)
      const fileResults = await this.processFiles(filteredFiles);

      // Step 4: Aggregate results
      const finalResult = await this.aggregateResults(fileResults, targetPath);

      const totalTime = Date.now() - startTime;

      return this.createSuccessResult(finalResult, {
        filesProcessed: filteredFiles.length,
        processingTime: totalTime,
        skippedFiles: files.length - filteredFiles.length
      });

    } catch (error) {
      const totalTime = Date.now() - startTime;
      this.logger.error('Extraction failed:', error);
      
      return this.createErrorResult(error, {
        processingTime: totalTime
      });
    }
  }

  /**
   * Step 1: Discover files to process based on targetPath
   */
  protected async discoverFiles(targetPath: string): Promise<string[]> {
    const isDirectory = await FileUtils.isDirectory(targetPath);
    
    if (isDirectory) {
      // Find files in directory using patterns
      const files: string[] = [];
      for (const pattern of this.extractorConfig.filePatterns!) {
        const foundFiles = await FileUtils.findFiles(pattern, {
          cwd: targetPath,
          ignore: this.extractorConfig.excludePatterns
        });
        files.push(...foundFiles);
      }
      return [...new Set(files)]; // Remove duplicates
    } else {
      // Single file
      const exists = await FileUtils.exists(targetPath);
      return exists ? [targetPath] : [];
    }
  }

  /**
   * Step 2: Filter files based on configuration and file properties
   */
  protected async filterFiles(files: string[]): Promise<string[]> {
    const filtered: string[] = [];

    for (const file of files) {
      // Check if plugin should process this file
      if (!this.shouldProcess(file)) {
        continue;
      }

      // Check file size
      const fileSize = await FileUtils.getFileSize(file);
      if (fileSize > this.extractorConfig.maxFileSize!) {
        this.logger.warn(`File too large: ${file} (${fileSize} bytes)`);
        continue;
      }

      // Check if it's in node_modules (unless explicitly included)
      if (!this.extractorConfig.includeNodeModules && file.includes('node_modules')) {
        continue;
      }

      filtered.push(file);
    }

    return filtered;
  }

  /**
   * Step 3: Process files with batching and parallel processing support
   */
  protected async processFiles(files: string[]): Promise<TFileResult[]> {
    const results: TFileResult[] = [];
    const batchSize = this.extractorConfig.batchSize!;

    if (this.extractorConfig.parallel) {
      // Process in parallel batches
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        
        const batchStartTime = Date.now();
        const batchResults = await Promise.all(
          batch.map(file => this.processFile(file))
        );
        const batchTime = Date.now() - batchStartTime;
        this.logger.debug(`Batch ${i / batchSize + 1} completed in ${batchTime}ms`);

        results.push(...batchResults.filter(result => result !== null) as TFileResult[]);
      }
    } else {
      // Process sequentially
      for (const file of files) {
        const fileStartTime = Date.now();
        const result = await this.processFile(file);
        const fileTime = Date.now() - fileStartTime;
        this.logger.debug(`File ${path.basename(file)} processed in ${fileTime}ms`);
        
        if (result !== null) {
          results.push(result);
        }
      }
    }

    return results;
  }

  /**
   * Process a single file - to be implemented by subclasses
   */
  protected abstract processFile(filePath: string): Promise<TFileResult | null>;

  /**
   * Step 4: Aggregate individual file results into final result
   */
  protected abstract aggregateResults(fileResults: TFileResult[], targetPath: string): Promise<TFinalResult>;

  /**
   * Helper methods for common AST operations
   */
  protected async parseFileWithCache(filePath: string) {
    const cacheKey = `ast:${filePath}`;
    
    if (this.context.cache?.has(cacheKey)) {
      return this.context.cache.get(cacheKey);
    }

    const parsed = await this.context.astUtils.parseFile(filePath);
    
    if (parsed && this.context.cache) {
      this.context.cache.set(cacheKey, parsed);
    }

    return parsed;
  }

  protected getRelativePath(filePath: string): string {
    return FileUtils.getRelativePath(this.context.projectPath, filePath);
  }

  /**
   * Result creation helpers
   */
  protected createSuccessResult(
    data: TFinalResult, 
    metadata: Record<string, any> = {}
  ): PluginResult {
    return {
      success: true,
      data,
      metadata: {
        pluginName: this.metadata.name,
        pluginVersion: this.metadata.version,
        ...metadata
      }
    };
  }

  protected createErrorResult(
    error: any, 
    metadata: Record<string, any> = {}
  ): PluginResult {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : String(error)],
      metadata: {
        pluginName: this.metadata.name,
        pluginVersion: this.metadata.version,
        ...metadata
      }
    };
  }

  /**
   * Format the extracted data for output
   * Each extractor must implement its own formatting logic
   */
  abstract formatData(data: TFinalResult, format?: 'text' | 'markdown' | 'json'): string;
}
