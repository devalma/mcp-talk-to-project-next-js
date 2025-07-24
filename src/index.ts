#!/usr/bin/env node

/**
 * Next.js Project Analyzer MCP Server
 * 
 * A Model Context Protocol server that provides comprehensive analysis
 * of Next.js projects through a plugin-based architecture.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializeRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { promises as fs } from 'fs';
import path from 'path';

// Core imports
import { PluginManager } from './plugins/manager.js';
import { registerAllPlugins } from './plugins/registry.js';
import { getAllTools, executeTool, getToolNames } from './tools/index.js';
import type { ToolContext } from './tools/types.js';
import { PluginLogger } from './plugins/common/logger.js';

// Resource system imports
import { getAllResourceDefinitions, generateResourceContent } from './resources/index.js';

// Prompt system imports
import { getAllPromptDefinitions, generatePrompt } from './prompts/index.js';

/**
 * Server Configuration
 */
const SERVER_INFO = {
  name: 'nextjs-project-analyzer',
  version: '2.0.0',
  description: 'Advanced Next.js project analysis through plugin-based architecture',
  protocolVersion: '2024-11-05',
} as const;

/**
 * Environment Configuration
 */
class ServerConfig {
  static readonly isDebugMode = process.env.MCP_DEBUG === 'true';
  
  static readonly projectPath = process.env.NEXTJS_PROJECT_PATH || 
                               process.argv[2] || 
                               process.cwd();
  static readonly resolvedProjectPath = path.resolve(this.projectPath);

  static configure() {
    // Configure logging based on environment
    if (!this.isDebugMode) {
      PluginLogger.setGlobalLevel('error');
    }
    
    if (this.isDebugMode) {
      console.error(`[DEBUG] Server starting in debug mode`);
      console.error(`[DEBUG] Project path: ${this.resolvedProjectPath}`);
      console.error(`[DEBUG] Available tools: ${getToolNames().join(', ')}`);
    }
  }
}

/**
 * Project Validation
 */
class ProjectValidator {
  static async validateProject(projectPath: string): Promise<void> {
    try {
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path "${projectPath}" is not a directory`);
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new Error(`Project path "${projectPath}" does not exist`);
      }
      throw error;
    }
  }

  static async checkIfNextJsProject(projectPath: string): Promise<boolean> {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      return !!(
        packageJson.dependencies?.next ||
        packageJson.devDependencies?.next ||
        packageJson.dependencies?.react ||
        packageJson.devDependencies?.react
      );
    } catch {
      return false; // Not necessarily an error, just not a Node.js project
    }
  }
}

/**
 * MCP Server Implementation
 */
class NextJsAnalyzerServer {
  private server: Server;
  private pluginManager: PluginManager;
  private toolContext: ToolContext;

  constructor(projectPath: string) {
    // Initialize plugin system
    this.pluginManager = new PluginManager(projectPath);
    registerAllPlugins(this.pluginManager);

    // Create tool context
    this.toolContext = {
      pluginManager: this.pluginManager,
      resolvedProjectPath: projectPath,
    };

    // Initialize MCP server
    this.server = new Server({
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
    });

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Initialize handler
    this.server.setRequestHandler(InitializeRequestSchema, async () => {
      const tools = getAllTools();
      
      if (ServerConfig.isDebugMode) {
        console.error(`[DEBUG] Server initialized with ${tools.length} tools`);
      }

      return {
        protocolVersion: SERVER_INFO.protocolVersion,
        capabilities: {
          tools: {
            listChanged: true,
          },
          resources: {
            subscribe: true,
            listChanged: true,
          },
          prompts: {
            listChanged: true,
          },
          logging: {
            level: ServerConfig.isDebugMode ? 'debug' : 'info',
          },
        },
        serverInfo: {
          name: SERVER_INFO.name,
          version: SERVER_INFO.version,
        },
      };
    });

    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = getAllTools();
      
      if (ServerConfig.isDebugMode) {
        console.error(`[DEBUG] Listing ${tools.length} available tools`);
      }

      return { tools };
    });

    // Tool execution handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      if (ServerConfig.isDebugMode) {
        console.error(`[DEBUG] Executing tool: ${name}`);
        console.error(`[DEBUG] Arguments:`, JSON.stringify(args, null, 2));
      }

      try {
        const result = await executeTool(name, args || {}, this.toolContext);
        
        if (ServerConfig.isDebugMode) {
          console.error(`[DEBUG] Tool ${name} executed successfully`);
        }
        
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (ServerConfig.isDebugMode) {
          console.error(`[ERROR] Tool ${name} failed:`, error);
        }

        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });

    // List resources handler
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = getAllResourceDefinitions().map(definition => ({
        ...definition,
        uri: `file://${this.toolContext.resolvedProjectPath}/${definition.uri.replace('file://', '')}`
      }));

      if (ServerConfig.isDebugMode) {
        console.error(`[DEBUG] Listing ${resources.length} available resources`);
      }

      return { resources };
    });

    // Read resource handler
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      if (ServerConfig.isDebugMode) {
        console.error(`[DEBUG] Reading resource: ${uri}`);
      }

      try {
        const content = await generateResourceContent(
          uri, 
          this.toolContext.resolvedProjectPath, 
          this.pluginManager
        );
        
        return {
          contents: [content],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (ServerConfig.isDebugMode) {
          console.error(`[ERROR] Failed to read resource ${uri}:`, error);
        }

        throw new Error(`Failed to read resource: ${errorMessage}`);
      }
    });

    // List prompts handler
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      const prompts = getAllPromptDefinitions();

      if (ServerConfig.isDebugMode) {
        console.error(`[DEBUG] Listing ${prompts.length} available prompts`);
      }

      return { prompts };
    });

    // Get prompt handler
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      if (ServerConfig.isDebugMode) {
        console.error(`[DEBUG] Getting prompt: ${name}`);
      }

      try {
        const prompt = await generatePrompt(name, args || {});
        return {
          description: prompt.description,
          messages: prompt.messages,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (ServerConfig.isDebugMode) {
          console.error(`[ERROR] Failed to get prompt ${name}:`, error);
        }

        throw new Error(`Failed to get prompt: ${errorMessage}`);
      }
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    
    // Setup connection event handlers
    this.server.onclose = async () => {
      if (ServerConfig.isDebugMode) {
        console.error('[DEBUG] Server connection closed');
      }
    };

    this.server.onerror = async (error) => {
      console.error('[ERROR] Server error:', error);
    };

    // Connect and start
    await this.server.connect(transport);
    
    if (ServerConfig.isDebugMode) {
      console.error('[DEBUG] MCP Server connected and ready');
    }
  }
}

/**
 * Main Application Entry Point
 */
async function main(): Promise<void> {
  try {
    // Configure environment
    ServerConfig.configure();

    // Validate project
    await ProjectValidator.validateProject(ServerConfig.resolvedProjectPath);
    
    // Check if it's a Next.js/React project (optional check)
    const isNextJs = await ProjectValidator.checkIfNextJsProject(ServerConfig.resolvedProjectPath);
    if (ServerConfig.isDebugMode) {
      console.error(`[DEBUG] Next.js/React project detected: ${isNextJs}`);
    }

    // Create and start server
    const server = new NextJsAnalyzerServer(ServerConfig.resolvedProjectPath);
    await server.start();

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[FATAL] ${errorMessage}`);
    process.exit(1);
  }
}

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
main().catch((error) => {
  console.error('[FATAL] Failed to start server:', error);
  process.exit(1);
});
