/**
 * Help Extractor Plugin - Dynamically generates help from registered plugins
 */

import { BaseExtractor, type ExtractorConfig } from '../common/base-extractor.js';
import { HelpFormatter } from './formatter.js';
import type { PluginResult, PluginMetadata } from '../../types/plugin.js';
import type { HelpData, HelpOptions, CommandInfo, CLIOption } from './types.js';

export interface HelpExtractorConfig extends ExtractorConfig {
  includeHidden?: boolean;
}

export interface HelpAnalysisResult {
  helpData: HelpData;
  availableCommands: string[];
  totalCommands: number;
}

/**
 * Help Extractor Plugin - builds help dynamically from plugin metadata
 */
export class HelpExtractorPlugin extends BaseExtractor<HelpAnalysisResult, HelpData> {
  private startTime = Date.now();
  
  get metadata(): PluginMetadata {
    return {
      name: 'help-extractor',
      version: '1.0.0',
      description: 'Dynamic help system built from plugin metadata',
      author: 'MCP Next.js Analyzer',
      tags: ['help', 'cli', 'documentation'],
      cli: {
        command: 'help',
        description: 'Show this help message',
        usage: 'node cli.js help [command] [options]',
        category: 'utility',
        options: [
          {
            name: '--format',
            description: 'Output format (text, markdown)',
            type: 'string',
            default: 'text'
          },
          {
            name: '--examples',
            description: 'Include examples in output',
            type: 'boolean',
            default: true
          },
          {
            name: '--options',
            description: 'Include detailed options information',
            type: 'boolean',
            default: true
          }
        ],
        examples: [
          'node cli.js help',
          'node cli.js help components',
          'node cli.js help --format=markdown'
        ]
      }
    };
  }

  constructor(config: HelpExtractorConfig = {}) {
    super({
      filePatterns: [], // This plugin doesn't process files
      excludePatterns: [],
      batchSize: 1,
      parallel: false,
      ...config
    });
  }

  shouldProcess(filePath: string): boolean {
    return true; // Help extractor should always be allowed to run
  }

  /**
   * Extract help data from plugin manager
   */
  async extract(targetPath: string, options: HelpOptions = {}): Promise<PluginResult> {
    try {
      this.logger.info('Generating dynamic help from registered plugins');
      
      // Get plugin manager instance from context
      const pluginManager = this.context?.cache?.get('pluginManager');
      if (!pluginManager) {
        // Fallback to a basic help structure
        const helpData = this.getDefaultHelpData();
        return {
          success: true,
          data: helpData,
          warnings: ['Plugin manager not available, showing basic help']
        };
      }
      
      const registeredPlugins = pluginManager.getRegisteredPlugins();
      const helpData = this.buildHelpData(registeredPlugins, options);
      
      const result: HelpAnalysisResult = {
        helpData,
        availableCommands: registeredPlugins
          .map((p: any) => p.metadata.cli?.command)
          .filter(Boolean) as string[],
        totalCommands: registeredPlugins.filter((p: any) => p.metadata.cli).length
      };

      return {
        success: true,
        data: helpData,
        metadata: {
          processingTime: Date.now() - this.startTime,
          totalCommands: result.totalCommands
        }
      };
    } catch (error: any) {
      this.logger.error('Failed to generate help', error);
      return {
        success: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Process files - not used by help plugin
   */
  protected async processFile(filePath: string): Promise<HelpAnalysisResult | null> {
    return null;
  }

  /**
   * Process results - formats help data
   */
  protected async processResults(results: HelpAnalysisResult[]): Promise<HelpData> {
    // Should only have one result
    return results[0]?.helpData || this.getDefaultHelpData();
  }

  /**
   * Aggregate results - required by BaseExtractor
   */
  protected async aggregateResults(results: HelpAnalysisResult[]): Promise<HelpData> {
    return this.processResults(results);
  }

  /**
   * Build help data from registered plugins
   */
  private buildHelpData(plugins: any[], options: HelpOptions): HelpData {
    const commands: CommandInfo[] = [];
    
    // Extract CLI metadata from plugins
    plugins.forEach(plugin => {
      const cli = plugin.metadata?.cli;
      if (cli) {
        commands.push({
          command: cli.command,
          description: cli.description,
          usage: cli.usage,
          options: cli.options || [],
          examples: cli.examples || [],
          category: cli.category || 'general'
        });
      }
    });

    // Add special commands
    commands.push({
      command: 'overview',
      description: 'Show project overview and summary',
      usage: 'node cli.js [project-path] overview',
      category: 'analysis',
      examples: [
        'node cli.js . overview',
        'node cli.js /path/to/project overview'
      ]
    });

    commands.push({
      command: 'all',
      description: 'Run all extractors and show comprehensive analysis',
      usage: 'node cli.js [project-path] all [options]',
      category: 'analysis',
      options: [
        {
          name: '--format',
          description: 'Output format (text, markdown)',
          type: 'string',
          default: 'text'
        }
      ],
      examples: [
        'node cli.js . all',
        'node cli.js /path/to/project all --format=markdown'
      ]
    });

    const helpData: HelpData = {
      title: 'Next.js Project Analyzer CLI',
      usage: 'node cli.js [project-path] [command] [options]',
      globalOptions: [
        {
          name: '--help, -h',
          description: 'Show help information',
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
      commands: commands.sort((a, b) => a.command.localeCompare(b.command)),
      examples: [
        'node cli.js . overview',
        'node cli.js /path/to/project components --props --hooks',
        'node cli.js . pages --no-api',
        'node cli.js . all --format=markdown',
        'node cli.js help components'
      ],
      notes: [
        'If no project path is provided, the current directory is used',
        'Most commands support --format=markdown for structured output',
        'Use "help [command]" to get detailed help for a specific command'
      ]
    };

    return helpData;
  }

  /**
   * Get default help data when no plugins are available
   */
  private getDefaultHelpData(): HelpData {
    return {
      title: 'Next.js Project Analyzer CLI',
      usage: 'node cli.js [project-path] [command] [options]',
      globalOptions: [],
      commands: [],
      examples: [],
      notes: ['No plugins are currently registered']
    };
  }

  /**
   * Format help data according to specified format
   */
  formatHelp(helpData: HelpData, format: 'text' | 'markdown' = 'text'): string {
    return HelpFormatter.format(helpData, format);
  }

  /**
   * Format extracted data (required by BaseExtractor)
   */
  formatData(data: HelpData, format: 'text' | 'markdown' | 'json' = 'text'): string {
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }
    return this.formatHelp(data, format as 'text' | 'markdown');
  }
}
