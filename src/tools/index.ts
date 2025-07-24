/**
 * MCP Tools Registry
 * 
 * Centralized registration and management of all MCP tools
 */

import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ToolDefinition, ToolContext } from './types.js';

// Import all tool definitions
import { analyzeComponentsTool } from './analyze-components.js';
import { analyzeHooksTool } from './analyze-hooks.js';
import { analyzePagesTool } from './analyze-pages.js';
import { analyzeFeaturesTools } from './analyze-features.js';
import { analyzePatternsTools } from './analyze-patterns.js';
import { projectOverviewTool } from './project-overview.js';
import { helpTool } from './help.js';

// Tool registry
const toolDefinitions: ToolDefinition[] = [
  analyzeComponentsTool,
  analyzeHooksTool,
  analyzePagesTool,
  analyzeFeaturesTools,
  analyzePatternsTools,
  projectOverviewTool,
  helpTool,
];

// Additional tools that can be added later
// import { analyzeFeaturesTools } from './analyze-features.js';
// import { analyzePatternsTools } from './analyze-patterns.js';
// import { helpTool } from './help.js';

/**
 * Get all tool definitions for MCP server registration
 */
export function getAllTools(): Tool[] {
  return toolDefinitions.map(toolDef => toolDef.definition);
}

/**
 * Get tool handler by name
 */
export function getToolHandler(toolName: string) {
  const toolDef = toolDefinitions.find(tool => tool.definition.name === toolName);
  return toolDef?.handler;
}

/**
 * Execute a tool by name with given arguments and context
 */
export async function executeTool(toolName: string, args: any, context: ToolContext): Promise<CallToolResult> {
  const handler = getToolHandler(toolName);
  if (!handler) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  
  try {
    return await handler(args, context);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Tool execution failed: ${errorMessage}`);
  }
}

/**
 * List all available tool names
 */
export function getToolNames(): string[] {
  return toolDefinitions.map(tool => tool.definition.name);
}

/**
 * Check if a tool exists
 */
export function hasTool(toolName: string): boolean {
  return toolDefinitions.some(tool => tool.definition.name === toolName);
}
