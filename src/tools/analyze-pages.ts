/**
 * Pages Analysis Tool
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PageFormatter } from '../plugins/page-extractor/formatter.js';
import type { ToolDefinition, ToolContext } from './types.js';
import { createTextResponse, createErrorResponse, resolveTargetPath } from './types.js';
import { z } from 'zod';

// Zod schema for page analysis arguments
const PageAnalysisArgsSchema = z.object({
  path: z.string().optional(),
  format: z.enum(['text', 'markdown', 'json']).default('json'),
  includeApiRoutes: z.boolean().default(true),
  mode: z.enum(['all', 'specific', 'detailed']).default('all'),
  pagePattern: z.string().optional(),
});

type PageAnalysisArgs = z.infer<typeof PageAnalysisArgsSchema>;

export const analyzePagesTool: ToolDefinition = {
  definition: {
    name: 'analyze_pages',
    description: 'Analyze Next.js pages and routing structure. Supports all pages, specific pages, or detailed analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Pages directory path to analyze (relative to project root, auto-detects pages or app)',
        },
        format: {
          type: 'string',
          enum: ['text', 'markdown', 'json'],
          description: 'Output format',
          default: 'json',
        },
        includeApiRoutes: {
          type: 'boolean',
          description: 'Include API routes information',
          default: true,
        },
        mode: {
          type: 'string',
          enum: ['all', 'specific', 'detailed'],
          description: 'Analysis mode: all (basic list), specific (single page), detailed (comprehensive analysis)',
          default: 'all',
        },
        pagePattern: {
          type: 'string',
          description: 'Pattern to match specific page(s) when mode is "specific" (e.g., "index", "api/*", "[slug]")',
        },
      },
    },
  } as Tool,

  handler: async (args: PageAnalysisArgs, context: ToolContext) => {
    try {
      // Validate and parse arguments with Zod
      const validatedArgs = PageAnalysisArgsSchema.parse(args);
      const targetPath = resolveTargetPath(validatedArgs, context.resolvedProjectPath);
      const format = validatedArgs.format;
      
      const result = await context.pluginManager.executePlugin('page-extractor', targetPath);
      if (!result.success || !result.data) {
        return createErrorResponse('No pages found or extraction failed.');
      }

      // Use the plugin's formatter with user-specified format
      const plugin = context.pluginManager.getPlugin('page-extractor');
      const formattedText = plugin?.formatData 
        ? plugin.formatData(result.data, format) 
        : PageFormatter.format(result.data, format);

      return createTextResponse(formattedText);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(`Invalid arguments: ${error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`);
      }
      const message = error instanceof Error ? error.message : String(error);
      return createErrorResponse(`Page analysis failed: ${message}`);
    }
  },
};
