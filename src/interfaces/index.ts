/**
 * Interface exports for the MCP Next.js Analyzer
 */

// Core interfaces
export * from './core.js';

// Extractor interfaces
export * from './extractors.js';

// Service interfaces
export * from './services.js';

// Container interfaces
export * from './container.js';

// Re-export commonly used types
export type {
  ComponentInfo,
  HookInfo,
  PageInfo,
  FeatureInfo,
  PropInfo
} from '../types/info.js';

export type {
  PluginContext,
  PluginResult,
  PluginConfig,
  Plugin,
  PluginMetadata
} from '../types/plugin.js';
