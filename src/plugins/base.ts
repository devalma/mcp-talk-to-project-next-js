import type { PluginContext, PluginResult, PluginConfig } from '../types/plugin.js';

/**
 * Base class for all extractor plugins
 */
export abstract class BasePlugin {
  public config: PluginConfig;
  protected context!: PluginContext;

  constructor(config: PluginConfig = {}) {
    this.config = {
      enabled: true,
      priority: 100,
      ...config
    };
  }

  /**
   * Initialize the plugin with context
   */
  init(context: PluginContext): void {
    this.context = context;
  }

  /**
   * Get plugin metadata
   */
  abstract get metadata(): {
    name: string;
    version: string;
    description: string;
    author?: string;
  };

  /**
   * Check if plugin should run for the given file/directory
   */
  abstract shouldProcess(filePath: string): boolean;

  /**
   * Extract information from the target
   */
  abstract extract(targetPath: string): Promise<PluginResult>;

  /**
   * Validate plugin configuration
   */
  validate(): boolean {
    return true;
  }

  /**
   * Get plugin priority for execution order
   */
  get priority(): number {
    return this.config.priority || 100;
  }

  /**
   * Check if plugin is enabled
   */
  get enabled(): boolean {
    return this.config.enabled !== false;
  }

  /**
   * Plugin dependencies (other plugins that must run first)
   */
  get dependencies(): string[] {
    return this.config.dependencies || [];
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Override in subclasses if needed
  }

  /**
   * Format extracted data for output
   * Default implementation returns JSON - override in subclasses for custom formatting
   */
  formatData(data: any, format: 'text' | 'markdown' | 'json' = 'text'): string {
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }
    // For text and markdown, fall back to JSON unless overridden
    return JSON.stringify(data, null, 2);
  }
}
