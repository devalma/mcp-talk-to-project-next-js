/**
 * Component Extractor Plugin - Using DRY utilities
 */

import { BaseExtractor, type ExtractorConfig } from '../common/base-extractor.js';
import { ReactComponentUtils, type ComponentInfo } from '../common/react-component-utils.js';
import { ReactHooksUtils } from '../common/react-hooks-utils.js';
import type { PluginResult, PluginMetadata } from '../../types/plugin.js';
import { ComponentFormatter } from './formatter.js';
import path from 'path';

// Enhanced config for component extraction
export interface ComponentExtractorConfig extends ExtractorConfig {
  includeProps?: boolean;
  includeHooks?: boolean;
  includeState?: boolean;
  strictMode?: boolean;
}

// Result types for component extraction
export interface ComponentAnalysisResult {
  filePath: string;
  components: ComponentInfo[];
  customHooks: Array<{
    name: string;
    type: 'builtin' | 'custom';
    isExported: boolean;
    params: string[];
  }>;
  isReactFile: boolean;
}

export interface ComponentExtractionSummary {
  totalFiles: number;
  totalComponents: number;
  functionalComponents: number;
  classComponents: number;
  customHooks: number;
  mostUsedHooks: Array<{ name: string; count: number }>;
  componentsByFile: Array<{ 
    file: string; 
    count: number;
    componentNames: string[];
  }>;
  components: Array<{
    name: string;
    type: 'functional' | 'class';
    file: string;
    isDefault: boolean;
    isExported: boolean;
    hasProps: boolean;
    hasState: boolean;
    hooks: string[];
  }>;
  customHooksList: Array<{
    name: string;
    file: string;
    isExported: boolean;
    params: string[];
  }>;
}

/**
 * Component Extractor Plugin using DRY utilities
 */
export class ComponentExtractorPlugin extends BaseExtractor<ComponentAnalysisResult, ComponentExtractionSummary> {
  
  get metadata(): PluginMetadata {
    return {
      name: 'component-extractor',
      version: '2.0.0',
      description: 'React component extractor using shared utilities',
      author: 'MCP Next.js Analyzer',
      cli: {
        command: 'components',
        description: 'List all React components',
        usage: 'node cli.js [project-path] components [options]',
        category: 'analysis',
        options: [
          {
            name: '--props',
            description: 'Include component props information',
            type: 'boolean',
            default: false
          },
          {
            name: '--hooks',
            description: 'Include hooks used by components',
            type: 'boolean',
            default: false
          },
          {
            name: '--state',
            description: 'Include component state information',
            type: 'boolean',
            default: false
          },
          {
            name: '--format',
            description: 'Output format (text, markdown)',
            type: 'string',
            default: 'text'
          }
        ],
        examples: [
          'node cli.js . components',
          'node cli.js . components --props --hooks',
          'node cli.js /path/to/project components --format=markdown'
        ]
      }
    };
  }

  constructor(config: ComponentExtractorConfig = {}) {
    super({
      filePatterns: ['**/*.{js,jsx,ts,tsx}'],
      excludePatterns: [
        '**/node_modules/**', 
        '**/.git/**', 
        '**/dist/**', 
        '**/build/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/*.stories.*'
      ],
      maxFileSize: 1024 * 1024, // 1MB
      batchSize: 5, // Process in smaller batches for components
      parallel: true,
      ...config
    });
  }

  shouldProcess(filePath: string): boolean {
    // For directories, always allow processing
    if (!path.extname(filePath)) {
      return true;
    }
    
    // For files, check extension
    const ext = path.extname(filePath).toLowerCase();
    return ['.js', '.jsx', '.ts', '.tsx'].includes(ext);
  }

  /**
   * Process a single file for component analysis
   */
  protected async processFile(filePath: string): Promise<ComponentAnalysisResult | null> {
    try {
      const parsed = await this.parseFileWithCache(filePath);
      if (!parsed || !parsed.ast) {
        this.logger.debug(`Skipping file (empty or parsing failed): ${filePath}`);
        return null;
      }

      const ast = parsed.ast; // Extract the actual AST from ParsedAST

      // Check if this is a React file
      const isReactFile = ReactComponentUtils.isReactComponentFile(ast);
      if (!isReactFile) {
        this.logger.debug(`Skipping non-React file: ${filePath}`);
        return {
          filePath: this.getRelativePath(filePath),
          components: [],
          customHooks: [],
          isReactFile: false
        };
      }

      // Extract components
      const components = ReactComponentUtils.findReactComponents(ast);
      this.logger.debug(`Found ${components.length} components in ${filePath}`);

      // Extract custom hooks if enabled
      const extractorConfig = this.extractorConfig as ComponentExtractorConfig;
      const customHooks = extractorConfig.includeHooks !== false 
        ? ReactHooksUtils.findCustomHooks(ast)
        : [];

      return {
        filePath: this.getRelativePath(filePath),
        components,
        customHooks,
        isReactFile: true
      };

    } catch (error) {
      this.logger.error(`Error processing file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Aggregate results from all processed files
   */
  protected async aggregateResults(
    fileResults: ComponentAnalysisResult[], 
    targetPath: string
  ): Promise<ComponentExtractionSummary> {
    
    const reactFiles = fileResults.filter(result => result.isReactFile);
    const allComponents = reactFiles.flatMap(result => result.components);
    const allCustomHooks = reactFiles.flatMap(result => result.customHooks);

    // Calculate summary statistics
    const functionalComponents = allComponents.filter(c => c.type === 'functional').length;
    const classComponents = allComponents.filter(c => c.type === 'class').length;
    const customHooks = allCustomHooks.filter(h => h.type === 'custom').length;

    // Find most used hooks from components
    const hookUsage = new Map<string, number>();
    for (const component of allComponents) {
      for (const hook of component.hooks) {
        hookUsage.set(hook, (hookUsage.get(hook) || 0) + 1);
      }
    }

    const mostUsedHooks = Array.from(hookUsage.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Components by file
    const componentsByFile = reactFiles
      .filter(result => result.components.length > 0)
      .map(result => ({
        file: result.filePath,
        count: result.components.length,
        componentNames: result.components.map(c => c.name)
      }))
      .sort((a, b) => b.count - a.count);

    this.logger.info(`Component extraction complete: ${allComponents.length} components, ${customHooks} custom hooks`);

    // Detailed component list with file information
    const components = allComponents.map(component => ({
      name: component.name,
      type: component.type,
      file: reactFiles.find(result => result.components.includes(component))?.filePath || 'unknown',
      isDefault: component.isDefault,
      isExported: component.isExported,
      hasProps: component.hasProps,
      hasState: component.hasState,
      hooks: component.hooks
    }));

    // Detailed custom hooks list with file information
    const customHooksList = allCustomHooks
      .filter(hook => hook.type === 'custom')
      .map(hook => ({
        name: hook.name,
        file: reactFiles.find(result => result.customHooks.includes(hook))?.filePath || 'unknown',
        isExported: hook.isExported,
        params: hook.params
      }));

    return {
      totalFiles: reactFiles.length,
      totalComponents: allComponents.length,
      functionalComponents,
      classComponents,
      customHooks,
      mostUsedHooks,
      componentsByFile,
      components,
      customHooksList
    };
  }

  /**
   * Format component data according to specified format
   */
  formatData(data: ComponentExtractionSummary, format: 'text' | 'markdown' | 'json' = 'text'): string {
    return ComponentFormatter.format(data, format);
  }
}
