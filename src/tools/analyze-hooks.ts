/**
 * Hooks Analysis Tool
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { HookFormatter } from '../plugins/hook-extractor/formatter.js';
import type { ToolDefinition, ToolContext } from './types.js';
import { createTextResponse, createErrorResponse, resolveTargetPath } from './types.js';
import { z } from 'zod';

// Zod schema for hook analysis arguments
const HookAnalysisArgsSchema = z.object({
  path: z.string().optional(),
  format: z.enum(['text', 'markdown', 'json']).default('json'),
  includeBuiltIn: z.boolean().default(true),
  includeCustom: z.boolean().default(true),
  mode: z.enum(['all', 'specific', 'detailed']).default('all'),
  hookPattern: z.string().optional(),
});

type HookAnalysisArgs = z.infer<typeof HookAnalysisArgsSchema>;

export const analyzeHooksTool: ToolDefinition = {
  definition: {
    name: 'analyze_hooks',
    description: 'Analyze React hooks usage in the project. Supports all hooks, specific hooks, or detailed analysis.',
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
        includeBuiltIn: {
          type: 'boolean',
          description: 'Include built-in React hooks',
          default: true,
        },
        includeCustom: {
          type: 'boolean',
          description: 'Include custom hooks',
          default: true,
        },
        mode: {
          type: 'string',
          enum: ['all', 'specific', 'detailed'],
          description: 'Analysis mode: all (basic list), specific (single hook), detailed (comprehensive analysis)',
          default: 'all',
        },
        hookPattern: {
          type: 'string',
          description: 'Pattern to match specific hook(s) when mode is "specific" (e.g., "useState", "use*", "*Auth*")',
        },
      },
    },
  } as Tool,

  handler: async (args: HookAnalysisArgs, context: ToolContext) => {
    try {
      // Validate and parse arguments with Zod
      const validatedArgs = HookAnalysisArgsSchema.parse(args);
      const targetPath = resolveTargetPath(validatedArgs, context.resolvedProjectPath);
      const format = validatedArgs.format;
      
      const result = await context.pluginManager.executePlugin('hook-extractor', targetPath);
      if (!result.success || !result.data) {
        return createErrorResponse('No hooks found or extraction failed.');
      }

      // Use the plugin's formatter with user-specified format
      const plugin = context.pluginManager.getPlugin('hook-extractor');
      const formattedText = plugin?.formatData 
        ? plugin.formatData(result.data, format) 
        : HookFormatter.format(result.data, format);

      return createTextResponse(formattedText);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(`Invalid arguments: ${error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`);
      }
      const message = error instanceof Error ? error.message : String(error);
      return createErrorResponse(`Hook analysis failed: ${message}`);
    }
  },
};
