/**
 * Project Overview Tool
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolDefinition, ToolContext } from './types.js';
import { createTextResponse, createErrorResponse } from './types.js';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const ProjectOverviewArgsSchema = z.object({
  format: z.enum(['text', 'markdown', 'json']).default('json').optional()
});

type ProjectOverviewArgs = z.infer<typeof ProjectOverviewArgsSchema>;

export const projectOverviewTool: ToolDefinition = {
  definition: {
    name: 'get_project_overview',
    description: 'Get comprehensive information about the entire Next.js project.',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['text', 'markdown', 'json'],
          description: 'Output format',
          default: 'json',
        },
      },
    },
  } as Tool,

  handler: async (args: ProjectOverviewArgs, context: ToolContext) => {
    try {
      // Validate and parse arguments with Zod
      const validatedArgs = ProjectOverviewArgsSchema.parse(args);
      const format = validatedArgs.format || 'json';
      const projectInfo = await getProjectInfo(context.resolvedProjectPath, context.pluginManager);

      if (format === 'json') {
        return createTextResponse(JSON.stringify(projectInfo, null, 2));
      }

      // Format as readable text or markdown
      const formattedText = formatProjectInfo(projectInfo, format);
      return createTextResponse(formattedText);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(`Invalid arguments: ${error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`);
      }
      const message = error instanceof Error ? error.message : String(error);
      return createErrorResponse(`Project overview failed: ${message}`);
    }
  },
};

async function getProjectInfo(projectPath: string, pluginManager: any) {
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = fs.existsSync(packageJsonPath) 
      ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
      : {};

    const nextConfigPath = path.join(projectPath, 'next.config.js');
    const nextConfigExists = fs.existsSync(nextConfigPath);

    // Detect project structure
    const hasAppDir = fs.existsSync(path.join(projectPath, 'app'));
    const hasPagesDir = fs.existsSync(path.join(projectPath, 'pages'));
    const hasSrcDir = fs.existsSync(path.join(projectPath, 'src'));

    let structure: 'pages' | 'app' | 'mixed' = 'pages';
    if (hasAppDir && hasPagesDir) {
      structure = 'mixed';
    } else if (hasAppDir) {
      structure = 'app';
    }

    // Get basic counts using plugin manager
    const componentsResult = await pluginManager.executePlugin('component-extractor', projectPath);
    const pagesResult = await pluginManager.executePlugin('page-extractor', projectPath);
    const hooksResult = await pluginManager.executePlugin('hook-extractor', projectPath);
    
    const components = componentsResult.success && componentsResult.data ? componentsResult.data : { totalComponents: 0 };
    const pages = pagesResult.success && pagesResult.data ? pagesResult.data : { pages: [] };
    const hooks = hooksResult.success && hooksResult.data ? hooksResult.data : { totalCustomHooks: 0 };

    return {
      name: packageJson.name || path.basename(projectPath),
      version: packageJson.version,
      nextVersion: packageJson.dependencies?.next || packageJson.devDependencies?.next,
      structure,
      typescript: fs.existsSync(path.join(projectPath, 'tsconfig.json')),
      componentCount: components.totalComponents || 0,
      pageCount: Array.isArray(pages.pages) ? pages.pages.filter((p: any) => p.type !== 'api').length : 0,
      apiRouteCount: Array.isArray(pages.pages) ? pages.pages.filter((p: any) => p.type === 'api').length : 0,
      customHookCount: hooks.totalCustomHooks || 0,
      hasSrcDirectory: hasSrcDir,
      hasAppDirectory: hasAppDir,
      hasPagesDirectory: hasPagesDir,
      hasNextConfig: nextConfigExists,
      dependencies: Object.keys(packageJson.dependencies || {}),
      devDependencies: Object.keys(packageJson.devDependencies || {}),
    };
  } catch (error) {
    console.error('Error getting project info:', error);
    return {
      name: path.basename(projectPath),
      error: 'Failed to read project information'
    };
  }
}

function formatProjectInfo(projectInfo: any, format: 'text' | 'markdown'): string {
  const lines: string[] = [];
  
  if (format === 'markdown') {
    lines.push(`# ${projectInfo.name || 'Next.js Project'}`);
    lines.push('');
    
    if (projectInfo.error) {
      lines.push(`**Error:** ${projectInfo.error}`);
      return lines.join('\n');
    }
    
    lines.push('## Project Information');
    lines.push(`- **Version:** ${projectInfo.version || 'N/A'}`);
    lines.push(`- **Next.js Version:** ${projectInfo.nextVersion || 'N/A'}`);
    lines.push(`- **Structure:** ${projectInfo.structure}`);
    lines.push(`- **TypeScript:** ${projectInfo.typescript ? 'Yes' : 'No'}`);
    lines.push('');
    
    lines.push('## Statistics');
    lines.push(`- **Components:** ${projectInfo.componentCount}`);
    lines.push(`- **Pages:** ${projectInfo.pageCount}`);
    lines.push(`- **API Routes:** ${projectInfo.apiRouteCount}`);
    lines.push(`- **Custom Hooks:** ${projectInfo.customHookCount}`);
    lines.push('');
    
    lines.push('## Project Structure');
    lines.push(`- **Source Directory:** ${projectInfo.hasSrcDirectory ? 'Yes' : 'No'}`);
    lines.push(`- **App Directory:** ${projectInfo.hasAppDirectory ? 'Yes' : 'No'}`);
    lines.push(`- **Pages Directory:** ${projectInfo.hasPagesDirectory ? 'Yes' : 'No'}`);
    lines.push(`- **Next Config:** ${projectInfo.hasNextConfig ? 'Yes' : 'No'}`);
    
  } else {
    // Text format
    lines.push(`Project: ${projectInfo.name || 'Next.js Project'}`);
    lines.push(''.padEnd(50, '='));
    
    if (projectInfo.error) {
      lines.push(`Error: ${projectInfo.error}`);
      return lines.join('\n');
    }
    
    lines.push(`Version: ${projectInfo.version || 'N/A'}`);
    lines.push(`Next.js Version: ${projectInfo.nextVersion || 'N/A'}`);
    lines.push(`Structure: ${projectInfo.structure}`);
    lines.push(`TypeScript: ${projectInfo.typescript ? 'Yes' : 'No'}`);
    lines.push('');
    
    lines.push('Statistics:');
    lines.push(`  Components: ${projectInfo.componentCount}`);
    lines.push(`  Pages: ${projectInfo.pageCount}`);
    lines.push(`  API Routes: ${projectInfo.apiRouteCount}`);
    lines.push(`  Custom Hooks: ${projectInfo.customHookCount}`);
    lines.push('');
    
    lines.push('Project Structure:');
    lines.push(`  Source Directory: ${projectInfo.hasSrcDirectory ? 'Yes' : 'No'}`);
    lines.push(`  App Directory: ${projectInfo.hasAppDirectory ? 'Yes' : 'No'}`);
    lines.push(`  Pages Directory: ${projectInfo.hasPagesDirectory ? 'Yes' : 'No'}`);
    lines.push(`  Next Config: ${projectInfo.hasNextConfig ? 'Yes' : 'No'}`);
  }
  
  return lines.join('\n');
}
