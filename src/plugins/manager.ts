import type { Plugin, PluginContext, PluginResult, PluginManager as IPluginManager } from '../types/plugin.js';
import { getProjectFiles, getRelativePath, readFileIfExists } from '../utils/file.js';
import { parseFile, isReactComponent, findImports, findExports } from '../parsers/ast.js';

/**
 * Plugin manager for handling extractor plugins
 */
export class PluginManager implements IPluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private context: PluginContext;
  private executionOrder: string[] = [];

  constructor(projectPath: string, targetPath?: string) {
    this.context = {
      projectPath,
      targetPath,
      fileUtils: {
        getProjectFiles: (pattern?: string) => getProjectFiles(projectPath, pattern),
        getRelativePath: (filePath: string) => getRelativePath(filePath, projectPath),
        readFile: (filePath: string) => readFileIfExists(filePath)
      },
      astUtils: {
        parseFile,
        isReactComponent: (node: any) => isReactComponent(node, ''),
        findImports,
        findExports
      },
      cache: new Map()
    };
  }

  /**
   * Register a plugin
   */
  register(plugin: Plugin): void {
    if (!plugin.validate()) {
      throw new Error(`Plugin ${plugin.metadata.name} failed validation`);
    }

    this.plugins.set(plugin.metadata.name, plugin);
    
    // Special handling for help extractor - provide access to plugin manager
    if (plugin.metadata.name === 'help-extractor') {
      this.context.cache?.set('pluginManager', this);
    }
    
    plugin.init(this.context);
    this.updateExecutionOrder();
  }

  /**
   * Unregister a plugin
   */
  unregister(pluginName: string): void {
    const plugin = this.plugins.get(pluginName);
    if (plugin) {
      plugin.cleanup();
      this.plugins.delete(pluginName);
      this.updateExecutionOrder();
    }
  }

  /**
   * Get a specific plugin
   */
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get all registered plugins (alias for CLI compatibility)
   */
  getRegisteredPlugins(): Plugin[] {
    return this.getAllPlugins();
  }

  /**
   * Execute a specific plugin
   */
  async executePlugin(name: string, targetPath: string): Promise<PluginResult> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      return {
        success: false,
        errors: [`Plugin ${name} not found`]
      };
    }

    if (!plugin.enabled) {
      return {
        success: false,
        errors: [`Plugin ${name} is disabled`]
      };
    }

    if (!plugin.shouldProcess(targetPath)) {
      return {
        success: true,
        data: null,
        warnings: [`Plugin ${name} skipped processing ${targetPath}`]
      };
    }

    try {
      const startTime = Date.now();
      const result = await plugin.extract(targetPath);
      const endTime = Date.now();

      return {
        ...result,
        metadata: {
          ...result.metadata,
          processingTime: endTime - startTime
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Plugin ${name} failed: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  /**
   * Execute all enabled plugins in dependency order
   */
  async executeAll(targetPath: string): Promise<Map<string, PluginResult>> {
    const results = new Map<string, PluginResult>();

    for (const pluginName of this.executionOrder) {
      const result = await this.executePlugin(pluginName, targetPath);
      results.set(pluginName, result);

      // If a plugin fails and is marked as critical, stop execution
      if (!result.success && this.isCriticalPlugin(pluginName)) {
        break;
      }
    }

    return results;
  }

  /**
   * Update the execution order based on dependencies and priorities
   */
  private updateExecutionOrder(): void {
    const plugins = Array.from(this.plugins.values())
      .filter(plugin => plugin.enabled);

    // Topological sort based on dependencies
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (pluginName: string) => {
      if (visiting.has(pluginName)) {
        throw new Error(`Circular dependency detected involving plugin: ${pluginName}`);
      }
      
      if (visited.has(pluginName)) {
        return;
      }

      const plugin = this.plugins.get(pluginName);
      if (!plugin) return;

      visiting.add(pluginName);

      // Visit dependencies first
      for (const dep of plugin.dependencies) {
        if (this.plugins.has(dep)) {
          visit(dep);
        }
      }

      visiting.delete(pluginName);
      visited.add(pluginName);
      order.push(pluginName);
    };

    // Sort by priority first, then apply topological sort
    const sortedPlugins = plugins.sort((a, b) => a.priority - b.priority);
    
    for (const plugin of sortedPlugins) {
      visit(plugin.metadata.name);
    }

    this.executionOrder = order;
  }

  /**
   * Check if a plugin is marked as critical
   */
  private isCriticalPlugin(pluginName: string): boolean {
    const plugin = this.plugins.get(pluginName);
    return plugin?.config.options?.critical === true;
  }

  /**
   * Update context for all plugins
   */
  updateContext(projectPath: string, targetPath?: string): void {
    this.context.projectPath = projectPath;
    this.context.targetPath = targetPath;
    this.context.fileUtils.getProjectFiles = (pattern?: string) => getProjectFiles(projectPath, pattern);
    this.context.fileUtils.getRelativePath = (filePath: string) => getRelativePath(filePath, projectPath);

    // Re-initialize all plugins with new context
    for (const plugin of this.plugins.values()) {
      plugin.init(this.context);
    }
  }

  /**
   * Get execution statistics
   */
  getStats(): {
    totalPlugins: number;
    enabledPlugins: number;
    executionOrder: string[];
  } {
    return {
      totalPlugins: this.plugins.size,
      enabledPlugins: this.getAllPlugins().filter(p => p.enabled).length,
      executionOrder: [...this.executionOrder]
    };
  }
}
