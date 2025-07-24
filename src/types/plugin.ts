/**
 * Plugin system types for the MCP Next.js analyzer
 */

export interface PluginConfig {
  enabled?: boolean;
  priority?: number;
  dependencies?: string[];
  options?: Record<string, any>;
}

export interface PluginContext {
  projectPath: string;
  targetPath?: string;
  fileUtils: {
    getProjectFiles: (pattern?: string) => string[];
    getRelativePath: (filePath: string) => string;
    readFile: (filePath: string) => string | null;
  };
  astUtils: {
    parseFile: (filePath: string) => any;
    isReactComponent: (node: any) => boolean;
    findImports: (ast: any) => any[];
    findExports: (ast: any) => any[];
  };
  cache?: Map<string, any>;
}

export interface PluginResult {
  success: boolean;
  data?: any;
  errors?: string[];
  warnings?: string[];
  metadata?: {
    processingTime?: number;
    filesProcessed?: number;
    [key: string]: any;
  };
}

export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  tags?: string[];
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

export interface Plugin {
  metadata: PluginMetadata;
  config: PluginConfig;
  enabled: boolean;
  priority: number;
  dependencies: string[];
  
  init(context: PluginContext): void;
  shouldProcess(filePath: string): boolean;
  extract(targetPath: string): Promise<PluginResult>;
  validate(): boolean;
  cleanup(): void;
  formatData?(data: any, format?: 'text' | 'markdown' | 'json'): string;
}

export interface PluginManager {
  register(plugin: Plugin): void;
  unregister(pluginName: string): void;
  getPlugin(name: string): Plugin | undefined;
  getAllPlugins(): Plugin[];
  executePlugin(name: string, targetPath: string): Promise<PluginResult>;
  executeAll(targetPath: string): Promise<Map<string, PluginResult>>;
}
