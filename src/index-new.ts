#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { promises as fs } from 'fs';
import path from 'path';
import { PluginManager } from './plugins/manager.js';
import { registerAllPlugins } from './plugins/registry.js';
import { getAllTools, executeTool } from './tools/index.js';
import type { ToolContext } from './tools/types.js';

// Get project path from command line argument or use current directory
const projectPath = process.argv[2] || process.cwd();
const resolvedProjectPath = path.resolve(projectPath);

// Initialize plugin manager
const pluginManager = new PluginManager(resolvedProjectPath);
registerAllPlugins(pluginManager);

// Create tool context
const toolContext: ToolContext = {
  pluginManager,
  resolvedProjectPath,
};

// Create server
const server = new Server(
  {
    name: 'nextjs-analyzer',
    version: '1.0.0',
    capabilities: {
      tools: {},
    },
  }
);

// Get all tool definitions from the tools registry
const tools = getAllTools();

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await executeTool(name, args || {}, toolContext);
    return result;
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
});

// Helper function to check if project exists
async function checkProjectExists(projectPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(projectPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

// Main function
async function main() {
  // Validate project path
  if (!(await checkProjectExists(resolvedProjectPath))) {
    console.error(`Error: Project path "${resolvedProjectPath}" does not exist.`);
    process.exit(1);
  }

  console.error(`Starting Next.js Analyzer MCP Server for project: ${resolvedProjectPath}`);

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Start the server
main().catch((error) => {
  console.error('Fatal error in main:', error);
  process.exit(1);
});
