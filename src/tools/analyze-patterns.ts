/**
 * Patterns Analysis Tool
 * 
 * Provides comprehensive analysis of React and Next.js patterns in the codebase
 */

import type { ToolDefinition, ToolContext } from './types.js';
import { createTextResponse, createErrorResponse } from './types.js';
import { z } from 'zod';
import path from 'path';

// Zod schema for pattern analysis arguments
const PatternAnalysisArgsSchema = z.object({
  path: z.string().optional(),
  format: z.enum(['text', 'markdown', 'json']).default('json'),
  patternType: z.enum(['hooks', 'context', 'hoc', 'render-props', 'all']).default('all'),
  mode: z.enum(['all', 'specific', 'detailed']).default('all'),
  patternPattern: z.string().optional(),
  detailed: z.boolean().default(false).describe('Deprecated: use mode="detailed"'),
});

type PatternAnalysisArgs = z.infer<typeof PatternAnalysisArgsSchema>;

export const analyzePatternsTools: ToolDefinition = {
  definition: {
    name: 'analyze_patterns',
    description: 'Analyze React and Next.js patterns in the codebase. Supports all patterns, specific patterns, or detailed analysis.',
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
        patternType: {
          type: 'string',
          enum: ['hooks', 'context', 'hoc', 'render-props', 'all'],
          description: 'Specific pattern type to analyze (optional, analyzes all patterns by default)',
          default: 'all',
        },
        mode: {
          type: 'string',
          enum: ['all', 'specific', 'detailed'],
          description: 'Analysis mode: all (basic list), specific (single pattern), detailed (comprehensive analysis)',
          default: 'all',
        },
        patternPattern: {
          type: 'string',
          description: 'Pattern to match specific pattern(s) when mode is "specific" (e.g., "withAuth", "*Provider", "use*")',
        },
        detailed: {
          type: 'boolean',
          description: 'Include detailed analysis of each pattern (deprecated: use mode="detailed")',
          default: false,
        },
      },
    },
  },
  handler: async (args: PatternAnalysisArgs, context: ToolContext) => {
    try {
      // Validate and parse arguments with Zod
      const validatedArgs = PatternAnalysisArgsSchema.parse(args);
      const { pluginManager, resolvedProjectPath } = context;
      
      const targetPath = validatedArgs.path 
        ? path.resolve(resolvedProjectPath, validatedArgs.path)
        : resolvedProjectPath;
      const format = validatedArgs.format;
      
      const result = await pluginManager.executePlugin('pattern-extractor', targetPath);
      if (!result.success || !result.data) {
        return createErrorResponse('No patterns found or extraction failed.');
      }

      // Use the plugin's formatter with user-specified format
      const plugin = pluginManager.getPlugin('pattern-extractor');
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
