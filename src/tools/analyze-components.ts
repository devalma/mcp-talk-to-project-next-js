/**
 * Component Analysis Tool
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ComponentFormatter } from '../plugins/component-extractor/formatter.js';
import type { ToolDefinition, ToolContext } from './types.js';
import { createTextResponse, createErrorResponse, resolveTargetPath } from './types.js';
import { z } from 'zod';

// Zod schema for component analysis arguments
const ComponentAnalysisArgsSchema = z.object({
  path: z.string().optional(),
  format: z.enum(['text', 'markdown', 'json']).default('json'),
  includeProps: z.boolean().default(false),
  includeHooks: z.boolean().default(false),
  mode: z.enum(['all', 'specific', 'detailed']).default('all'),
  componentPattern: z.string().optional(),
});

type ComponentAnalysisArgs = z.infer<typeof ComponentAnalysisArgsSchema>;

export const analyzeComponentsTool: ToolDefinition = {
  definition: {
    name: 'analyze_components',
    description: 'Analyze React components in the project. Supports all components, specific components, or detailed analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory or file path to analyze (relative to project root, defaults to entire project)',
        },
        format: {
          type: 'string',
          enum: ['text', 'markdown', 'json'],
          description: 'Output format',
          default: 'json',
        },
        includeProps: {
          type: 'boolean',
          description: 'Include component props information',
          default: false,
        },
        includeHooks: {
          type: 'boolean',
          description: 'Include hooks usage information',
          default: false,
        },
        mode: {
          type: 'string',
          enum: ['all', 'specific', 'detailed'],
          description: 'Analysis mode: all (basic list), specific (single component), detailed (comprehensive analysis)',
          default: 'all',
        },
        componentPattern: {
          type: 'string',
          description: 'Pattern to match specific component(s) when mode is "specific" (e.g., "Button", "*Modal", "Auth*")',
        },
      },
    },
  } as Tool,

  handler: async (args: ComponentAnalysisArgs, context: ToolContext) => {
    try {
      // Validate and parse arguments with Zod
      const validatedArgs = ComponentAnalysisArgsSchema.parse(args);
      const targetPath = resolveTargetPath(validatedArgs, context.resolvedProjectPath);
      const format = validatedArgs.format;
      
      const result = await context.pluginManager.executePlugin('component-extractor', targetPath);
      if (!result.success || !result.data) {
        return createErrorResponse('No components found or extraction failed.');
      }

      // Use the plugin's formatter with user-specified format
      const plugin = context.pluginManager.getPlugin('component-extractor');
      const formattedText = plugin?.formatData 
        ? plugin.formatData(result.data, format) 
        : ComponentFormatter.format(result.data, format);

      return createTextResponse(formattedText);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(`Invalid arguments: ${error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`);
      }
      const message = error instanceof Error ? error.message : String(error);
      return createErrorResponse(`Component analysis failed: ${message}`);
    }
  },
};
