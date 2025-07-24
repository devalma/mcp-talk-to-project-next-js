/**
 * Resource Registry
 * 
 * Central registry of all available MCP resources
 */

import type { ResourceDefinition, ResourceRegistry } from './types.js';
import { projectStructureHandler, analysisSummaryHandler } from './handlers.js';

/**
 * Standard resource definitions
 */
export const PROJECT_STRUCTURE_RESOURCE: ResourceDefinition = {
  uri: 'file://project-structure',
  name: 'Project Structure',
  description: 'Complete file system structure and organization of the Next.js project',
  mimeType: 'text/plain',
};

export const ANALYSIS_SUMMARY_RESOURCE: ResourceDefinition = {
  uri: 'file://analysis-summary',
  name: 'Comprehensive Analysis Data',
  description: 'Detailed analysis data including components, pages, hooks, features, patterns, and project overview',
  mimeType: 'application/json',
};

/**
 * Resource registry mapping resource URIs to their definitions and handlers
 */
export const resourceRegistry: ResourceRegistry = {
  'project-structure': {
    definition: PROJECT_STRUCTURE_RESOURCE,
    handler: projectStructureHandler,
  },
  'analysis-summary': {
    definition: ANALYSIS_SUMMARY_RESOURCE,
    handler: analysisSummaryHandler,
  },
};

/**
 * Get all available resource definitions
 */
export function getAllResourceDefinitions(): ResourceDefinition[] {
  return Object.values(resourceRegistry).map(resource => resource.definition);
}

/**
 * Get resource definition by URI suffix
 */
export function getResourceDefinition(uriSuffix: string): ResourceDefinition | undefined {
  return resourceRegistry[uriSuffix]?.definition;
}

/**
 * Get resource handler by URI suffix
 */
export function getResourceHandler(uriSuffix: string) {
  return resourceRegistry[uriSuffix]?.handler;
}

/**
 * Generate resource content by URI
 */
export async function generateResourceContent(
  uri: string, 
  projectPath: string, 
  pluginManager: any
): Promise<{ uri: string; mimeType: string; text: string }> {
  // Extract the resource key from the URI
  const uriSuffix = uri.split('/').pop() || '';
  const resource = resourceRegistry[uriSuffix];
  
  if (!resource) {
    throw new Error(`Unknown resource: ${uri}`);
  }

  const content = await resource.handler.generate(projectPath, pluginManager);
  
  return {
    uri,
    mimeType: resource.definition.mimeType,
    text: content,
  };
}
