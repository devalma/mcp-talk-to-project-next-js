/**
 * I18n Analysis Tool - MCP tool for analyzing internationalization patterns
 */

import type { ToolDefinition, ToolContext } from './types.js';
import { createTextResponse, createErrorResponse } from './types.js';
import { z } from 'zod';
import path from 'path';

// Zod schema for i18n analysis arguments
const I18nAnalysisArgsSchema = z.object({
  path: z.string().optional().describe('Path to analyze (relative to project root)'),
  functions: z.string().optional().describe('Translation function names (comma-separated)'),
  minLength: z.number().min(1).max(100).optional().describe('Minimum string length to consider'),
  languages: z.string().optional().describe('Languages to check (comma-separated)'),
  jsxText: z.boolean().optional().describe('Include JSX text analysis'),
  stringLiterals: z.boolean().optional().describe('Include string literals analysis'),
  format: z.enum(['text', 'markdown', 'json']).optional().describe('Output format')
});

type I18nAnalysisArgs = z.infer<typeof I18nAnalysisArgsSchema>;

export const analyzeI18nTool: ToolDefinition = {
  definition: {
    name: 'analyze_i18n',
    description: 'Analyze internationalization patterns, detect untranslated strings, and identify missing translation keys in React/Next.js projects.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to analyze (relative to project root). If not provided, analyzes entire project.',
        },
        functions: {
          type: 'string',
          description: 'Translation function names to detect (comma-separated). Default: t,translate,$t,i18n.t',
        },
        minLength: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          description: 'Minimum string length to consider for translation (default: 3)',
        },
        languages: {
          type: 'string',
          description: 'Languages to check for missing keys (comma-separated). Default: en,es,fr,de',
        },
        jsxText: {
          type: 'boolean',
          description: 'Include JSX text content analysis (default: true)',
        },
        stringLiterals: {
          type: 'boolean',
          description: 'Include string literals analysis (default: true)',
        },
        format: {
          type: 'string',
          enum: ['text', 'markdown', 'json'],
          description: 'Output format (default: text)',
        },
      },
    },
  },
  handler: async (args: I18nAnalysisArgs, context: ToolContext) => {
    try {
      // Validate and parse arguments with Zod
      const validatedArgs = I18nAnalysisArgsSchema.parse(args);
      const { pluginManager, resolvedProjectPath } = context;
      
      const targetPath = validatedArgs.path 
        ? path.resolve(resolvedProjectPath, validatedArgs.path)
        : resolvedProjectPath;
      const format = validatedArgs.format || 'text';
      
      // Configure the i18n plugin
      const plugin = pluginManager.getPlugin('i18n-extractor');
      if (!plugin) {
        return createErrorResponse('I18n extractor plugin not found. Make sure it is properly registered.');
      }

      // Build configuration from arguments
      const config: any = {};
      
      if (validatedArgs.functions) {
        config.translationFunctions = validatedArgs.functions.split(',').map(f => f.trim());
      }
      
      if (validatedArgs.minLength !== undefined) {
        config.minStringLength = validatedArgs.minLength;
      }
      
      if (validatedArgs.languages) {
        config.languages = validatedArgs.languages.split(',').map(l => l.trim());
      }
      
      if (validatedArgs.jsxText !== undefined) {
        config.analyzeJSXText = validatedArgs.jsxText;
      }
      
      if (validatedArgs.stringLiterals !== undefined) {
        config.analyzeStringLiterals = validatedArgs.stringLiterals;
      }

      // Create a new plugin instance with the configuration
      const { I18nExtractorPlugin } = await import('../plugins/i18n-extractor/index.js');
      const configuredPlugin = new I18nExtractorPlugin(config);
      
      // Execute the plugin
      const result = await configuredPlugin.extract(targetPath);
      
      if (!result.success || !result.data) {
        return createErrorResponse('No i18n analysis data found or extraction failed.');
      }

      // Use the plugin's formatter with user-specified format
      const formattedText = configuredPlugin.formatData 
        ? configuredPlugin.formatData(result.data, format) 
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
