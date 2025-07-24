/**
 * Resources Module
 * 
 * Centralized resource management for the MCP server
 */

export * from './types.js';
export * from './handlers.js';
export * from './registry.js';

// Re-export commonly used resource definitions for convenience
export {
  PROJECT_STRUCTURE_RESOURCE,
  ANALYSIS_SUMMARY_RESOURCE,
  getAllResourceDefinitions,
  getResourceDefinition,
  getResourceHandler,
  generateResourceContent,
} from './registry.js';
