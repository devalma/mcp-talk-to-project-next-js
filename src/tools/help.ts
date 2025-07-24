/**
 * Help Tool
 * 
 * Provides help information about available commands and usage
 */

import type { ToolDefinition, ToolContext } from './types.js';
import { createTextResponse, createErrorResponse } from './types.js';
import { z } from 'zod';

const HelpArgsSchema = z.object({
  format: z.enum(['text', 'markdown', 'json']).default('json').optional(),
  command: z.string().optional()
});

type HelpArgs = z.infer<typeof HelpArgsSchema>;

export const helpTool: ToolDefinition = {
  definition: {
    name: 'get_help',
    description: 'Get help information about available commands and usage.',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['text', 'markdown', 'json'],
          description: 'Output format',
          default: 'json',
        },
        command: {
          type: 'string',
          description: 'Get help for a specific command (optional)',
        },
      },
    },
  },
  handler: async (args: HelpArgs, context: ToolContext) => {
    try {
      // Validate and parse arguments with Zod
      const validatedArgs = HelpArgsSchema.parse(args);
      const { pluginManager, resolvedProjectPath } = context;
      const format = validatedArgs.format || 'json';
      
      const result = await pluginManager.executePlugin('help-extractor', resolvedProjectPath);
      if (!result.success || !result.data) {
        // Fallback help content
        const helpContent = {
          tools: [
            {
              name: 'analyze_components',
              description: 'Analyze React components',
              usage: 'Supports path filtering and various output formats',
            },
            {
              name: 'analyze_hooks',
              description: 'Analyze React hooks usage',
              usage: 'Supports filtering custom vs built-in hooks',
            },
            {
              name: 'analyze_pages',
              description: 'Analyze Next.js pages and routing',
              usage: 'Auto-detects pages or app directory structure',
            },
            {
              name: 'analyze_features',
              description: 'Analyze project features and modules',
              usage: 'Provides module organization insights',
            },
            {
              name: 'analyze_patterns',
              description: 'Analyze React patterns',
              usage: 'Detects hooks, context, HOC, and render props patterns',
            },
            {
              name: 'get_project_overview',
              description: 'Get comprehensive project information',
              usage: 'Shows project structure, dependencies, and statistics',
            },
          ],
        };
        
        if (format === 'json') {
          return createTextResponse(JSON.stringify(helpContent, null, 2));
        }
        
        const textHelp = `# Next.js Project Analyzer Help

Available Commands:
${helpContent.tools.map(tool => `
## ${tool.name}
${tool.description}
Usage: ${tool.usage}
`).join('')}

All commands support:
- path: Specify target directory/file (relative to project root)
- format: Choose output format (text, markdown, json)
`;
        
        return createTextResponse(textHelp);
      }

      // Use the plugin's formatter with user-specified format
      const plugin = pluginManager.getPlugin('help-extractor');
      const formattedText = plugin?.formatData 
        ? plugin.formatData(result.data, format) 
        : JSON.stringify(result.data, null, 2);

      return createTextResponse(formattedText);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(`Invalid arguments: ${error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`);
      }
      return createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  },
};
