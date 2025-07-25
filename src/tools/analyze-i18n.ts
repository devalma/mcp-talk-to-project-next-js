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

      // Build configuration from arguments and apply to existing plugin
      const configUpdate: any = {};
      
      if (validatedArgs.functions) {
        configUpdate.translationFunctions = validatedArgs.functions.split(',').map(f => f.trim());
      }
      
      if (validatedArgs.minLength !== undefined) {
        configUpdate.minStringLength = validatedArgs.minLength;
      }
      
      if (validatedArgs.languages) {
        configUpdate.languages = validatedArgs.languages.split(',').map(l => l.trim());
      }
      
      if (validatedArgs.jsxText !== undefined) {
        configUpdate.analyzeJSXText = validatedArgs.jsxText;
      }
      
      if (validatedArgs.stringLiterals !== undefined) {
        configUpdate.analyzeStringLiterals = validatedArgs.stringLiterals;
      }

      // Execute the plugin using plugin manager (same as CLI)
      const result = await pluginManager.executePlugin('i18n-extractor', targetPath);
      
      if (!result.success) {
        const errorMessage = result.errors?.join(', ') || 'Unknown extraction error';
        return createErrorResponse(`I18n analysis failed: ${errorMessage}`);
      }

      if (!result.data) {
        return createErrorResponse('No i18n analysis data returned from plugin');
      }

      // Use the plugin's formatter with user-specified format
      let formattedText: string;
      try {
        formattedText = plugin.formatData 
          ? plugin.formatData(result.data, format) 
          : JSON.stringify(result.data, null, 2);
      } catch (formatError) {
        return createErrorResponse(`Error formatting result: ${formatError instanceof Error ? formatError.message : String(formatError)}`);
      }

      return createTextResponse(formattedText);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(`Invalid arguments: ${error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`);
      }
      return createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  },
};
