/**
 * Features Analysis Tool
 * 
 * Provides comprehensive analysis of project features and module organization
 */

import type { ToolDefinition, ToolContext } from './types.js';
import { createTextResponse, createErrorResponse } from './types.js';
import { z } from 'zod';
import path from 'path';

// Zod schema for feature analysis arguments
const FeatureAnalysisArgsSchema = z.object({
  path: z.string().optional(),
  format: z.enum(['text', 'markdown', 'json']).default('json'),
  includeTypes: z.boolean().default(false),
  mode: z.enum(['all', 'specific', 'detailed']).default('all'),
  featurePattern: z.string().optional(),
  detailed: z.boolean().default(false).describe('Deprecated: use mode="detailed"'),
});

type FeatureAnalysisArgs = z.infer<typeof FeatureAnalysisArgsSchema>;

export const analyzeFeaturesTools: ToolDefinition = {
  definition: {
    name: 'analyze_features',
    description: 'Analyze project features and module organization. Supports all features, specific features, or detailed analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Source directory path to analyze (relative to project root)',
          default: 'src',
        },
        format: {
          type: 'string',
          enum: ['text', 'markdown', 'json'],
          description: 'Output format',
          default: 'json',
        },
        includeTypes: {
          type: 'boolean',
          description: 'Include TypeScript type information',
          default: false,
        },
        mode: {
          type: 'string',
          enum: ['all', 'specific', 'detailed'],
          description: 'Analysis mode: all (basic list), specific (single feature), detailed (comprehensive analysis)',
          default: 'all',
        },
        featurePattern: {
          type: 'string',
          description: 'Pattern to match specific feature(s) when mode is "specific" (e.g., "auth", "*admin*", "user*")',
        },
        detailed: {
          type: 'boolean',
          description: 'Include detailed analysis of each feature (deprecated: use mode="detailed")',
          default: false,
        },
      },
    },
  },
  handler: async (args: FeatureAnalysisArgs, context: ToolContext) => {
    try {
      // Validate and parse arguments with Zod
      const validatedArgs = FeatureAnalysisArgsSchema.parse(args);
      const { pluginManager, resolvedProjectPath } = context;
      
      const targetPath = validatedArgs.path 
        ? path.resolve(resolvedProjectPath, validatedArgs.path)
        : resolvedProjectPath;
      const format = validatedArgs.format;
      
      const result = await pluginManager.executePlugin('feature-extractor', targetPath);
      if (!result.success || !result.data) {
        return createErrorResponse('No features found or extraction failed.');
      }

      // Use the plugin's formatter with user-specified format
      const plugin = pluginManager.getPlugin('feature-extractor');
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
