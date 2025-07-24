/**
 * Component Extractor Plugin - Clean DRY Implementation
 * 
 * This plugin uses shared DRY utilities:
 * - BaseExtractor for common file processing patterns
 * - ReactComponentUtils for component analysis
 * - ReactHooksUtils for hooks analysis
 * - Common utilities for file operations, caching, logging
 * 
 * Total plugin code: ~150 lines vs ~500+ lines in monolithic version
 */

export { 
  ComponentExtractorPlugin,
  type ComponentExtractorConfig,
  type ComponentAnalysisResult,
  type ComponentExtractionSummary
} from './plugin.js';

// Plugin factory function
import { ComponentExtractorPlugin, type ComponentExtractorConfig } from './plugin.js';

export function createComponentExtractorPlugin(config?: ComponentExtractorConfig) {
  return new ComponentExtractorPlugin(config);
}

// Plugin metadata for registration
export const COMPONENT_EXTRACTOR_PLUGIN = {
  name: 'component-extractor',
  version: '2.0.0',
  description: 'React component extractor using DRY utilities',
  factory: createComponentExtractorPlugin
} as const;
