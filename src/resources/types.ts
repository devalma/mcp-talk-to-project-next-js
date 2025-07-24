/**
 * Resource System Types
 * 
 * Type definitions for the MCP resource system
 */

export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface ResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

export interface ResourceHandler {
  generate(projectPath: string, pluginManager: any): Promise<string>;
}

export interface ResourceRegistry {
  [key: string]: {
    definition: ResourceDefinition;
    handler: ResourceHandler;
  };
}

export interface ResourceContext {
  projectPath: string;
  pluginManager: any;
}
