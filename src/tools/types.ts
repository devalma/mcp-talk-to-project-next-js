/**
 * Common types for MCP tools
 */

import type { Tool, CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { PluginManager } from '../plugins/manager.js';

export interface ToolContext {
  pluginManager: PluginManager;
  resolvedProjectPath: string;
}

export interface ToolHandler {
  (args: any, context: ToolContext): Promise<CallToolResult>;
}

export interface ToolDefinition {
  definition: Tool;
  handler: ToolHandler;
}

export interface FormatOptions {
  format: 'text' | 'markdown' | 'json';
}

export interface PathOptions {
  path?: string;
}

export interface AnalysisToolArgs extends FormatOptions, PathOptions {
  [key: string]: any;
}

/**
 * Helper function to create standardized text responses
 */
export function createTextResponse(text: string): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text,
      } as TextContent,
    ],
    isError: false,
  };
}

/**
 * Helper function to handle tool errors consistently
 */
export function createErrorResponse(message: string): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: `Error: ${message}`,
      } as TextContent,
    ],
    isError: true,
  };
}

/**
 * Helper function to resolve target path
 */
export function resolveTargetPath(args: PathOptions, projectPath: string): string {
  return args.path 
    ? require('path').resolve(projectPath, args.path)
    : projectPath;
}
